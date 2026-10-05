import path from "node:path";
import fs from "node:fs";
import type { Hono } from "hono";
import type { AppContext } from "../app.js";
import { parseJsonc } from "../engine/jsonc.js";
import { parseToml } from "../engine/toml.js";
import type { PatchOp } from "../engine/ops.js";

interface PluginEntry {
  id: string;
  enabled: boolean;
  meta?: Record<string, unknown>;
}

interface HostPluginSupport {
  file: string | null;
  readonly: boolean;
  effectModel: string;
  list(): PluginEntry[];
  toggle(id: string): Promise<{ changed: boolean; backup: string | null }>;
}

function readJson(file: string): Record<string, unknown> | null {
  try {
    return parseJsonc<Record<string, unknown>>(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function zcodeSupport(ctx: AppContext): HostPluginSupport {
  const registryFile = path.join(ctx.paths.hostRoots.zcode, "cli", "plugins", "installed_plugins.json");
  const configFile = path.join(ctx.paths.hostRoots.zcode, "cli", "config.json");
  return {
    file: registryFile,
    readonly: false,
    effectModel: "restart",
    list() {
      const reg = readJson(registryFile) as { plugins?: Record<string, unknown>[] } | null;
      const cfg = readJson(configFile) as { plugins?: { enabledPlugins?: string[] } } | null;
      const enabled = new Set(cfg?.plugins?.enabledPlugins ?? []);
      return (reg?.plugins ?? []).map((p) => {
        const id = String(p.id ?? p.name ?? "");
        return { id, enabled: enabled.has(id), meta: p };
      });
    },
    async toggle(id) {
      const cfg = readJson(configFile) as { plugins?: { enabledPlugins?: string[] } } | null;
      const current = cfg?.plugins?.enabledPlugins ?? [];
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      const ops: PatchOp[] = [{ op: "jsonSet", path: ["plugins", "enabledPlugins"], value: next }];
      if (!fs.existsSync(configFile)) {
        await fspWrite(configFile, "{}\n");
      }
      return ctx.engine.patchFile(configFile, ops);
    },
  };
}

import fsp from "node:fs/promises";
async function fspWrite(file: string, content: string): Promise<void> {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, content, "utf8");
}

function codexSupport(ctx: AppContext): HostPluginSupport {
  const file = path.join(ctx.paths.hostRoots.codex, "config.toml");
  return {
    file,
    readonly: false,
    effectModel: "restart",
    list() {
      try {
        const parsed = parseToml<{ plugins?: Record<string, { enabled?: boolean }> }>(
          fs.readFileSync(file, "utf8"),
        );
        return Object.entries(parsed.plugins ?? {}).map(([id, v]) => ({
          id,
          enabled: v.enabled !== false,
        }));
      } catch {
        return [];
      }
    },
    async toggle(id) {
      const current = this.list().find((e) => e.id === id);
      if (!current) throw new Error(`插件不存在:${id}`);
      return ctx.engine.patchFile(file, [
        { op: "setScalar", table: ["plugins", id], key: "enabled", value: !current.enabled },
      ]);
    },
  };
}

function opencodeSupport(ctx: AppContext): HostPluginSupport {
  const file = path.join(ctx.paths.hostRoots.opencode, "opencode.json");
  const list = (): string[] => {
    const cfg = readJson(file) as { plugin?: unknown } | null;
    if (Array.isArray(cfg?.plugin)) return cfg.plugin.filter((x): x is string => typeof x === "string");
    return [];
  };
  return {
    file,
    readonly: false,
    effectModel: "restart",
    list() {
      // npm 式安装的插件以配置内登记的名单为准(启用即登记)
      return list().map((id) => ({ id, enabled: true }));
    },
    async toggle(id) {
      const current = list();
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      return ctx.engine.patchFile(file, [{ op: "jsonSet", path: ["plugin"], value: next }]);
    },
  };
}

export function registerPluginRoutes(app: Hono, ctx: AppContext) {
  const supports: Record<string, HostPluginSupport> = {
    zcode: zcodeSupport(ctx),
    codex: codexSupport(ctx),
    opencode: opencodeSupport(ctx),
    // dsh 插件走 cordis/pnpm 体系,单独建模(T12/T13)
    dsh: { file: null, readonly: true, effectModel: "next-request", list: () => [], toggle: async () => ({ changed: false, backup: null }) },
  };

  app.get("/api/plugins", (c) => {
    const hosts: Record<string, unknown> = {};
    for (const [hostId, s] of Object.entries(supports)) {
      hosts[hostId] = { readonly: s.readonly, effectModel: s.effectModel, file: s.file, entries: s.list() };
    }
    return c.json({ hosts });
  });

  app.post("/api/plugins/:hostId/:id/toggle", async (c) => {
    const s = supports[c.req.param("hostId")];
    if (!s) return c.json({ error: "未知宿主" }, 404);
    if (s.readonly || !s.file) return c.json({ error: "该宿主插件域为只读" }, 403);
    try {
      const result = await s.toggle(decodeURIComponent(c.req.param("id")));
      return c.json(result);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  });
}
