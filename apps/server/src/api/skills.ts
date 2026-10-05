import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Hono } from "hono";
import type { AppContext } from "../app.js";
import { listSkills, type SkillItem } from "../skills.js";
import { guardInsideHome } from "../app.js";

const execFileP = promisify(execFile);

interface ManagedStore {
  ids: Set<string>;
}

function loadManaged(dataDir: string): ManagedStore {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, "managed-skills.json"), "utf8")) as { ids: string[] };
    return { ids: new Set(raw.ids) };
  } catch {
    return { ids: new Set() };
  }
}

function saveManaged(dataDir: string, m: ManagedStore): void {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "managed-skills.json"), JSON.stringify({ ids: [...m.ids] }, null, 2));
}

function findItem(items: SkillItem[], id: string): SkillItem | null {
  return items.find((i) => i.id === id) ?? null;
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.cp(src, dest, { recursive: true });
}

/** .agents 下的启停同步维护 skill-lock(加法合并,不动其余键) */
async function syncSkillLock(ctx: AppContext, skillsDir: string, name: string, disabled: boolean): Promise<void> {
  if (!skillsDir.replace(/\\/g, "/").includes(".agents/skills")) return;
  const lockFile = path.join(skillsDir, "..", ".skill-lock.json");
  const abs = path.resolve(lockFile);
  if (!fs.existsSync(abs)) return;
  await ctx.engine.patchFile(abs, [
    { op: "jsonSet", path: ["skills", name, "disabled"], value: disabled },
    { op: "jsonSet", path: ["skills", name, "updatedAt"], value: Date.now() },
  ]);
}

export function registerSkillRoutes(app: Hono, ctx: AppContext) {
  app.get("/api/skills", async (c) => {
    const { discoverProjects } = await import("../scan.js");
    const projects = await discoverProjects(ctx.settings);
    const items = listSkills(ctx.homeDir, ctx.paths.hostRoots, projects);
    const managed = loadManaged(ctx.dataDir);
    for (const item of items) {
      if (managed.ids.has(item.id)) item.provenance = "managed";
      if (item.disabled) item.provenance = "managed";
    }
    return c.json({ items, projects });
  });

  app.post("/api/skills/toggle", async (c) => {
    const body = (await c.req.json()) as { id: string; enabled: boolean };
    const { discoverProjects } = await import("../scan.js");
    const projects = await discoverProjects(ctx.settings);
    const items = listSkills(ctx.homeDir, ctx.paths.hostRoots, projects);
    const item = findItem(items, body.id);
    if (!item) return c.json({ error: "skill 不存在" }, 404);
    if (item.layer === "builtin") {
      return c.json({ error: "内置层只读,不可启停(ADR-0003)" }, 403);
    }
    // item.dir = <skillsDir>/<name>(启用中)或 <skillsDir>/.disabled/<name>(已禁用)
    const skillsDir = item.disabled ? path.dirname(path.dirname(item.dir)) : path.dirname(item.dir);
    const targetDisabledDir = path.join(skillsDir, ".disabled");
    const target = body.enabled
      ? path.join(skillsDir, item.name)
      : path.join(targetDisabledDir, item.name);
    guardInsideHome(ctx.homeDir, target);
    if (fs.existsSync(target)) return c.json({ error: `目标已存在:${target}` }, 409);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.rename(item.dir, target);
    await syncSkillLock(ctx, skillsDir, item.name, !body.enabled);
    const managed = loadManaged(ctx.dataDir);
    managed.ids.add(`${item.layer}:${target}`);
    saveManaged(ctx.dataDir, managed);
    return c.json({ ok: true, dir: target, disabled: !body.enabled });
  });

  app.post("/api/skills/install", async (c) => {
    const body = (await c.req.json()) as {
      source: string;
      targetLayer: "user" | "project";
      project?: string;
      name?: string;
    };
    if (!body.source) return c.json({ error: "source 必填" }, 400);
    if (body.targetLayer === "project" && !body.project) {
      return c.json({ error: "项目层安装需要 project 参数" }, 400);
    }
    // 解析来源:本地目录 | owner/repo[/sub] | git URL
    let srcDir: string | null = null;
    let tmpDir: string | null = null;
    const raw = body.source.replace(/\\/g, "/");
    try {
      if (fs.existsSync(raw) && fs.statSync(raw).isDirectory()) {
        srcDir = path.resolve(raw);
      } else {
        let url: string;
        let sub = "";
        if (/^https?:\/\/|^git@/.test(raw)) {
          url = raw;
        } else {
          const seg = raw.split("/");
          if (seg.length < 2) return c.json({ error: "来源必须是 本地目录 / owner/repo[/sub] / git URL" }, 400);
          url = `https://github.com/${seg[0]}/${seg[1]}.git`;
          sub = seg.slice(2).join("/");
        }
        tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "aienv-install-"));
        await execFileP("git", ["clone", "--depth", "1", "--quiet", url, tmpDir], { timeout: 120000 });
        srcDir = sub ? path.join(tmpDir, sub) : tmpDir;
      }
      if (!fs.existsSync(path.join(srcDir, "SKILL.md"))) {
        return c.json({ error: `来源中没有 SKILL.md:${srcDir}` }, 400);
      }
      const name = body.name ?? path.basename(srcDir);
      const skillsDir =
        body.targetLayer === "user"
          ? path.join(ctx.homeDir, ".agents", "skills")
          : path.join(guardInsideHome(ctx.homeDir, body.project), ".agents", "skills");
      const dest = path.join(skillsDir, name);
      guardInsideHome(ctx.homeDir, dest);
      if (fs.existsSync(dest)) return c.json({ error: `目标已存在:${dest}` }, 409);
      await copyDir(srcDir, dest);
      return c.json({ ok: true, dir: dest });
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    } finally {
      if (tmpDir) await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  app.post("/api/skills/copy", async (c) => {
    const body = (await c.req.json()) as { id: string; toLayer: "user" | "project"; project?: string };
    const { discoverProjects } = await import("../scan.js");
    const projects = await discoverProjects(ctx.settings);
    const item = findItem(listSkills(ctx.homeDir, ctx.paths.hostRoots, projects), body.id);
    if (!item) return c.json({ error: "skill 不存在" }, 404);
    if (item.layer === "builtin") return c.json({ error: "内置层只读" }, 403);
    const destDir =
      body.toLayer === "user"
        ? path.join(ctx.homeDir, ".agents", "skills")
        : path.join(guardInsideHome(ctx.homeDir, body.project ?? ""), ".agents", "skills");
    if (body.toLayer === "project" && !body.project) return c.json({ error: "需要 project 参数" }, 400);
    const dest = path.join(destDir, item.name);
    if (fs.existsSync(dest)) return c.json({ error: `目标已存在:${dest}` }, 409);
    await copyDir(item.dir, dest);
    return c.json({ ok: true, dir: dest });
  });
}
