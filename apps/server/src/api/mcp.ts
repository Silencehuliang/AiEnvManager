import path from "node:path";
import fs from "node:fs";
import type { Hono } from "hono";
import type { AppContext } from "../app.js";
import { parseJsonc } from "../engine/jsonc.js";
import { parseToml } from "../engine/toml.js";
import type { PatchOp } from "../engine/ops.js";

export interface McpEntry {
  name: string;
  command?: string;
  url?: string;
  enabled: boolean;
  /** 定义文件 */
  file: string;
}

interface HostMcpSupport {
  file: string | null;
  readonly: boolean;
  effectModel: string;
  list(): McpEntry[];
  addOps(name: string, spec: { command?: string; args?: string[]; url?: string }): PatchOp[];
  toggleOps(name: string, enabled: boolean): PatchOp[];
  removeOps(name: string): PatchOp[];
}

function readJson(file: string): Record<string, unknown> | null {
  try {
    return parseJsonc<Record<string, unknown>>(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function zcodeSupport(hostRoot: string): HostMcpSupport {
  const file = path.join(hostRoot, "cli", "config.json");
  const servers = (): Record<string, Record<string, unknown>> => {
    const cfg = readJson(file);
    const mcp = cfg?.mcp as { servers?: Record<string, Record<string, unknown>> } | undefined;
    return mcp?.servers ?? {};
  };
  return {
    file,
    readonly: false,
    effectModel: "restart",
    list() {
      return Object.entries(servers()).map(([name, v]) => ({
        name,
        command: typeof v.command === "string" ? v.command : undefined,
        enabled: v.enabled !== false,
        file,
      }));
    },
    addOps(name, spec) {
      const value: Record<string, unknown> = { command: spec.command ?? "", enabled: true };
      if (spec.args) value.args = spec.args;
      return [{ op: "jsonSet", path: ["mcp", "servers", name], value }];
    },
    toggleOps(name, enabled) {
      return [{ op: "jsonSet", path: ["mcp", "servers", name, "enabled"], value: enabled }];
    },
    removeOps(name) {
      return [{ op: "jsonRemove", path: ["mcp", "servers", name] }];
    },
  };
}

function codexSupport(hostRoot: string): HostMcpSupport {
  const file = path.join(hostRoot, "config.toml");
  const list = (): Record<string, Record<string, unknown>> => {
    try {
      const parsed = parseToml<{ mcp_servers?: Record<string, Record<string, unknown>> }>(
        fs.readFileSync(file, "utf8"),
      );
      return parsed.mcp_servers ?? {};
    } catch {
      return {};
    }
  };
  return {
    file,
    readonly: false,
    effectModel: "restart",
    list() {
      return Object.entries(list()).map(([name, v]) => ({
        name,
        command: typeof v.command === "string" ? v.command : undefined,
        enabled: v.enabled !== false,
        file,
      }));
    },
    addOps(name, spec) {
      const ops: PatchOp[] = [{ op: "setScalar", table: ["mcp_servers", name], key: "command", value: spec.command ?? "" }];
      if (spec.args) ops.push({ op: "setScalar", table: ["mcp_servers", name], key: "args", value: spec.args });
      return ops;
    },
    toggleOps(name, enabled) {
      return [{ op: "setScalar", table: ["mcp_servers", name], key: "enabled", value: enabled }];
    },
    removeOps(name) {
      return [{ op: "removeTable", table: ["mcp_servers", name] }];
    },
  };
}

function opencodeSupport(hostRoot: string): HostMcpSupport {
  const file = path.join(hostRoot, "opencode.json");
  const servers = (): Record<string, Record<string, unknown>> => {
    const cfg = readJson(file);
    return (cfg?.mcp as Record<string, Record<string, unknown>>) ?? {};
  };
  return {
    file,
    readonly: false,
    effectModel: "restart",
    list() {
      return Object.entries(servers()).map(([name, v]) => ({
        name,
        command: typeof v.command === "string" ? v.command : undefined,
        enabled: v.enabled !== false,
        file,
      }));
    },
    addOps(name, spec) {
      return [{ op: "jsonSet", path: ["mcp", name], value: { type: "local", command: spec.command ?? "", enabled: true } }];
    },
    toggleOps(name, enabled) {
      return [{ op: "jsonSet", path: ["mcp", name, "enabled"], value: enabled }];
    },
    removeOps(name) {
      return [{ op: "jsonRemove", path: ["mcp", name] }];
    },
  };
}

export function registerMcpRoutes(app: Hono, ctx: AppContext) {
  const supports: Record<string, HostMcpSupport> = {
    zcode: zcodeSupport(ctx.paths.hostRoots.zcode),
    codex: codexSupport(ctx.paths.hostRoots.codex),
    opencode: opencodeSupport(ctx.paths.hostRoots.opencode),
    // dsh 无独立 MCP 配置面(官方走插件生态),只读(ADR-0003)
    dsh: {
      file: null,
      readonly: true,
      effectModel: "next-request",
      list: () => [],
      addOps: () => [],
      toggleOps: () => [],
      removeOps: () => [],
    },
  };

  app.get("/api/mcp", (c) => {
    const hosts: Record<string, unknown> = {};
    for (const [hostId, s] of Object.entries(supports)) {
      hosts[hostId] = { readonly: s.readonly, effectModel: s.effectModel, file: s.file, entries: s.list() };
    }
    return c.json({ hosts });
  });

  app.post("/api/mcp/:hostId", async (c) => {
    const s = supports[c.req.param("hostId")];
    if (!s) return c.json({ error: "未知宿主" }, 404);
    if (s.readonly || !s.file) return c.json({ error: "该宿主的 MCP 域为只读(dsh 走插件生态)" }, 403);
    const body = (await c.req.json()) as { name: string; command?: string; args?: string[]; url?: string };
    if (!body.name) return c.json({ error: "name 必填" }, 400);
    const result = await ctx.engine.patchFile(s.file, s.addOps(body.name, body));
    return c.json(result);
  });

  app.post("/api/mcp/:hostId/:name/toggle", async (c) => {
    const s = supports[c.req.param("hostId")];
    const name = c.req.param("name");
    if (!s) return c.json({ error: "未知宿主" }, 404);
    if (s.readonly || !s.file) return c.json({ error: "该宿主的 MCP 域为只读" }, 403);
    const body = (await c.req.json().catch(() => ({}))) as { enabled?: boolean };
    const current = s.list().find((e) => e.name === name);
    if (!current) return c.json({ error: "MCP server 不存在" }, 404);
    const enabled = body.enabled ?? !current.enabled;
    const result = await ctx.engine.patchFile(s.file, s.toggleOps(name, enabled));
    return c.json({ ...result, enabled });
  });

  app.delete("/api/mcp/:hostId/:name", async (c) => {
    const s = supports[c.req.param("hostId")];
    const name = c.req.param("name");
    if (!s) return c.json({ error: "未知宿主" }, 404);
    if (s.readonly || !s.file) return c.json({ error: "该宿主的 MCP 域为只读" }, 403);
    if (!s.list().some((e) => e.name === name)) return c.json({ error: "MCP server 不存在" }, 404);
    const result = await ctx.engine.patchFile(s.file, s.removeOps(name));
    return c.json(result);
  });
}
