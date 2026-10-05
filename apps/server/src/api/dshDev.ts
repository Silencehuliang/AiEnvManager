import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { parse as parseYamlText } from "yaml";
import type { Hono } from "hono";
import type { AppContext } from "../app.js";
import { discoverProjects } from "../scan.js";

export interface DshDevPatchEntry {
  id: string;
  name?: string;
  disabled: boolean;
  raw: unknown;
}

export interface DshDevProject {
  root: string;
  packageName: string | null;
  /** 开发中插件的本地 patch 条目 */
  patchEntries: DshDevPatchEntry[];
  /** 挂载状态:被哪些 profile 经依赖/patch 引用 */
  mountedIn: { profile: string; via: string }[];
  /** 本地条目与 profile 内同名条目的差异 */
  diffs: { id: string; profile: string; status: "absent" | "same" | "different" }[];
}

interface PatchRecord {
  id?: unknown;
  name?: unknown;
  disabled?: unknown;
}

function readPatchEntries(file: string): DshDevPatchEntry[] {
  if (!fs.existsSync(file)) return [];
  try {
    const doc = parseYamlText(fs.readFileSync(file, "utf8")) as unknown;
    if (!Array.isArray(doc)) return [];
    return doc
      .filter((e): e is PatchRecord => !!e && typeof e === "object" && typeof (e as PatchRecord).id === "string")
      .map((e) => ({
        id: e.id as string,
        name: typeof e.name === "string" ? e.name : undefined,
        disabled: e.disabled === true,
        raw: e,
      }));
  } catch {
    return [];
  }
}

export function registerDshDevRoutes(app: Hono, ctx: AppContext) {
  app.get("/api/dsh/dev", async (c) => {
    const projects = await discoverProjects(ctx.settings);
    const dshRoot = ctx.paths.hostRoots.dsh;
    const profilesDir = path.join(dshRoot, "profiles");
    // 收集各 profile 的依赖与 patch 条目
    let profileNames: string[] = [];
    try {
      profileNames = fs
        .readdirSync(profilesDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch {
      profileNames = [];
    }
    const profileState = profileNames.map((name) => {
      const dir = path.join(profilesDir, name);
      let deps: Record<string, string> = {};
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        deps = { ...pkg.dependencies, ...pkg.devDependencies };
      } catch {
        deps = {};
      }
      return { name, deps, entries: readPatchEntries(path.join(dir, "cordis.patch.yml")) };
    });

    const out: DshDevProject[] = [];
    for (const proj of projects) {
      const patchFile = path.join(proj.root, "cordis.patch.yml");
      const hasPatch = fs.existsSync(patchFile);
      const pkgFile = path.join(proj.root, "package.json");
      let packageName: string | null = null;
      let isDshProject = hasPatch;
      if (fs.existsSync(pkgFile)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8")) as {
            name?: string;
            dsh?: Record<string, unknown>;
          };
          packageName = typeof pkg.name === "string" ? pkg.name : null;
          if (pkg.dsh) isDshProject = true;
        } catch {
          /* 忽略 */
        }
      }
      if (!isDshProject) continue;
      const entries = readPatchEntries(patchFile);
      const mountedIn: DshDevProject["mountedIn"] = [];
      const diffs: DshDevProject["diffs"] = [];
      for (const p of profileState) {
        const viaDep = packageName && p.deps[packageName] ? `package.json 依赖(${p.deps[packageName]})` : null;
        if (viaDep) mountedIn.push({ profile: p.name, via: viaDep });
        for (const entry of entries) {
          const match = p.entries.find((e) => e.id === entry.id);
          if (packageName && typeof entry.name === "string" && entry.name === packageName) {
            mountedIn.push({ profile: p.name, via: "patch 条目 name 引用" });
          }
          if (match) {
            const same = JSON.stringify(match.raw) === JSON.stringify(entry.raw);
            diffs.push({ id: entry.id, profile: p.name, status: same ? "same" : "different" });
          } else {
            diffs.push({ id: entry.id, profile: p.name, status: "absent" });
          }
        }
      }
      out.push({ root: proj.root, packageName, patchEntries: entries, mountedIn, diffs });
    }
    return c.json({ projects: out, readonly: true, note: "开发者视图为只读(一键重载/调试不进 v1)" });
  });
  void fsp;
}
