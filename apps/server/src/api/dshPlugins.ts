import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { parse as parseYamlText } from "yaml";
import type { Hono } from "hono";
import type { AppContext } from "../app.js";
import { guardInsideHome } from "../app.js";

export interface DshPatchEntry {
  id: string;
  name?: string;
  disabled: boolean;
  /** 是否由本工具写入(托管态) */
  managed: boolean;
}

export interface DshProfileTree {
  name: string;
  dir: string;
  /** package.json 的 dsh.profile.bundles(基础层) */
  bundles: string[];
  /** cordis.patch.yml 条目(用户层,按 id 覆盖/禁用/插入) */
  entries: DshPatchEntry[];
  patchFile: string;
}

function loadManaged(dataDir: string): Set<string> {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, "managed-dsh-plugins.json"), "utf8")) as {
      keys: string[];
    };
    return new Set(raw.keys);
  } catch {
    return new Set();
  }
}

function saveManaged(dataDir: string, keys: Set<string>): void {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, "managed-dsh-plugins.json"),
    JSON.stringify({ keys: [...keys] }, null, 2),
  );
}

function readProfileTree(dshRoot: string, profile: string, managed: Set<string>): DshProfileTree | null {
  const dir = path.join(dshRoot, "profiles", profile);
  const pkgFile = path.join(dir, "package.json");
  const patchFile = path.join(dir, "cordis.patch.yml");
  if (!fs.existsSync(pkgFile)) return null;
  let bundles: string[] = [];
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8")) as {
      dsh?: { profile?: { bundles?: string[] } };
    };
    bundles = pkg.dsh?.profile?.bundles ?? [];
  } catch {
    bundles = [];
  }
  const entries: DshPatchEntry[] = [];
  if (fs.existsSync(patchFile)) {
    try {
      const doc = parseYamlText(fs.readFileSync(patchFile, "utf8")) as unknown;
      if (Array.isArray(doc)) {
        for (const e of doc) {
          if (!e || typeof e !== "object") continue;
          const rec = e as Record<string, unknown>;
          if (typeof rec.id !== "string") continue;
          entries.push({
            id: rec.id,
            name: typeof rec.name === "string" ? rec.name : undefined,
            disabled: rec.disabled === true,
            managed: managed.has(`${profile}\u0000${rec.id}`),
          });
        }
      }
    } catch {
      /* patch 解析失败按空处理 */
    }
  }
  return { name: profile, dir, bundles, entries, patchFile };
}

export function registerDshPluginRoutes(app: Hono, ctx: AppContext) {
  const dshRoot = ctx.paths.hostRoots.dsh;

  app.get("/api/dsh/profiles", (c) => {
    const profilesDir = path.join(dshRoot, "profiles");
    let names: string[] = [];
    try {
      names = fs
        .readdirSync(profilesDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch {
      names = [];
    }
    const managed = loadManaged(ctx.dataDir);
    const profiles = names
      .map((n) => readProfileTree(dshRoot, n, managed))
      .filter((t): t is DshProfileTree => t !== null);
    return c.json({
      profiles,
      effectModel: "next-request",
      note: "组合树 v1:基础层 bundles + 用户层 patch 条目;对 bundles 内插件的禁用经 patch 条目按 id 覆盖",
    });
  });

  app.post("/api/dsh/profiles/:name/toggle", async (c) => {
    const profile = c.req.param("name");
    const body = (await c.req.json()) as { pluginId: string; disabled: boolean };
    if (!body.pluginId) return c.json({ error: "pluginId 必填" }, 400);
    const dir = guardInsideHome(ctx.homeDir, path.join(dshRoot, "profiles", profile));
    const patchFile = path.join(dir, "cordis.patch.yml");
    if (!fs.existsSync(patchFile)) {
      await fsp.mkdir(path.dirname(patchFile), { recursive: true });
      await fsp.writeFile(patchFile, "[]\n", "utf8");
    }
    const ops = [
      { op: "yamlUpsertById" as const, id: body.pluginId, fields: { disabled: body.disabled } },
    ];
    const result = await ctx.engine.patchFile(patchFile, ops);
    const managed = loadManaged(ctx.dataDir);
    managed.add(`${profile}\u0000${body.pluginId}`);
    saveManaged(ctx.dataDir, managed);
    return c.json({ ...result, profile, pluginId: body.pluginId, disabled: body.disabled });
  });
}
