import path from "node:path";
import crypto from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import fsp from "node:fs/promises";
import { Hono } from "hono";
import type { HostId, HostInfo, HostsResponse } from "@aienv/shared";
import { HOST_DEFS, resolvePaths, type AppPaths } from "./paths.js";
import { loadSettings, type Settings } from "./settings.js";
import { WriteEngine, ConflictError } from "./engine/writer.js";
import { detectFormat } from "./engine/ops.js";
import { ProviderStore } from "./providerStore.js";
import { saveSettings } from "./settings.js";
import { discoverProjects } from "./scan.js";
import { listSkills } from "./skills.js";
import { createOpencodeAdapter } from "./adapters/opencode.js";
import { createCodexAdapter } from "./adapters/codex.js";
import { createDshAdapter } from "./adapters/dsh.js";
import { createZcodeAdapter } from "./adapters/zcode.js";
import type { ProviderAdapter } from "./adapters/types.js";
import { registerProviderRoutes } from "./api/providers.js";

function sha1(content: string): string {
  return crypto.createHash("sha1").update(content).digest("hex");
}

export interface AppOptions {
  /** 覆盖用户主目录(fixture 测试注入点) */
  homeDir?: string;
  /** 覆盖本工具数据目录(默认 ~/.aienvmanager) */
  dataDir?: string;
}

export interface AppContext {
  app: Hono;
  paths: AppPaths;
  engine: WriteEngine;
  settings: Settings;
  dataDir: string;
  homeDir: string;
  store: ProviderStore;
  adapters: Map<HostId, ProviderAdapter>;
  hashOf: (content: string) => string;
}

export function guardInsideHome(homeDir: string, p: string): string {
  const home = path.resolve(homeDir);
  const resolved = path.resolve(p);
  if (resolved !== home && !resolved.startsWith(home + path.sep)) {
    throw new Error(`路径必须位于用户主目录内:${resolved}`);
  }
  return resolved;
}

export async function createApp(opts: AppOptions = {}): Promise<AppContext> {
  const paths = resolvePaths(opts.homeDir);
  if (opts.dataDir) paths.dataDir = opts.dataDir;
  const settings = await loadSettings(paths.dataDir);
  const engine = new WriteEngine(paths.dataDir, settings.backupKeep);
  const store = new ProviderStore(path.join(paths.dataDir, "registry.json"));
  const adapters = new Map<HostId, ProviderAdapter>();
  adapters.set("opencode", createOpencodeAdapter(paths.hostRoots.opencode));
  adapters.set("codex", createCodexAdapter(paths.hostRoots.codex));
  adapters.set("dsh", createDshAdapter(paths.hostRoots.dsh));
  adapters.set("zcode", createZcodeAdapter(paths.hostRoots.zcode));

  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof ConflictError) return c.json({ error: err.message }, 409);
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 400);
  });

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.get("/api/hosts", (c) => {
    const hosts: HostInfo[] = HOST_DEFS.map((def) => {
      const root = paths.hostRoots[def.id];
      return {
        id: def.id,
        name: def.name,
        detected: existsSync(root),
        root,
        configPaths: def.configPaths.map((p) => path.join(root, ...p.split("/"))),
      };
    });
    const body: HostsResponse = { hosts };
    return c.json(body);
  });

  // ---- 通用配置读写(供各域与调试复用)----

  app.get("/api/config/read", (c) => {
    const file = guardInsideHome(paths.homeDir, c.req.query("path") ?? "");
    try {
      const content = readFileSync(file, "utf8");
      const st = statSync(file);
      return c.json({
        path: file,
        content,
        hash: sha1(content),
        format: detectFormat(file),
        mtimeMs: st.mtimeMs,
      });
    } catch {
      return c.json({ error: `文件不存在:${file}` }, 404);
    }
  });

  app.post("/api/config/patch", async (c) => {
    const body = (await c.req.json()) as {
      path: string;
      ops: Parameters<WriteEngine["patchFile"]>[1];
      keep?: number;
      /** 乐观锁:客户端上次 read 返回的 hash;不匹配 → 409 */
      expectedHash?: string;
    };
    const file = guardInsideHome(paths.homeDir, body.path);
    if (body.expectedHash) {
      const current = readFileSync(file, "utf8");
      if (sha1(current) !== body.expectedHash) {
        throw new ConflictError(
          `文件自上次读取后被外部修改(可能是宿主 CLI 正在运行),已拒绝写入,请刷新后重试:${file}`,
        );
      }
    }
    const result = await engine.patchFile(file, body.ops, body.keep);
    return c.json(result);
  });

  app.get("/api/config/backups", async (c) => {
    const file = guardInsideHome(paths.homeDir, c.req.query("path") ?? "");
    const entries = await engine.backups.list(file);
    const original = await engine.backups.readOriginalPath(file);
    return c.json({ original, entries });
  });

  app.post("/api/config/restore", async (c) => {
    const body = (await c.req.json()) as { backup: string; path?: string };
    const backupAbs = path.resolve(body.backup);
    if (!backupAbs.startsWith(path.join(paths.dataDir, "backups") + path.sep)) {
      return c.json({ error: "备份路径不合法" }, 400);
    }
    let target = body.path ? guardInsideHome(paths.homeDir, body.path) : null;
    if (!target) {
      try {
        const meta = JSON.parse(
          await fsp.readFile(path.join(path.dirname(backupAbs), "meta.json"), "utf8"),
        ) as { original: string };
        target = guardInsideHome(paths.homeDir, meta.original);
      } catch {
        return c.json({ error: "找不到备份元数据" }, 404);
      }
    }
    const content = await engine.backups.read(backupAbs);
    // 恢复前先对当前状态做快照,保证可再回滚
    await engine.snapshot(target);
    const tmp = `${target}.aienv-tmp-${Date.now()}`;
    await fsp.writeFile(tmp, content, "utf8");
    await fsp.rename(tmp, target);
    return c.json({ ok: true, restored: target });
  });

  // ---- 供应商档案库与切换 ----
  registerProviderRoutes(app, { app, paths, engine, settings, dataDir: paths.dataDir, homeDir: paths.homeDir, store, adapters, hashOf: sha1 }, adapters);

  // ---- 设置(扫描根/排除/备份份数)----
  app.get("/api/settings", (c) => c.json(settings));
  app.put("/api/settings", async (c) => {
    const patch = (await c.req.json()) as Partial<Settings>;
    Object.assign(settings, patch);
    await saveSettings(paths.dataDir, settings);
    return c.json(settings);
  });

  // ---- Skills 三层盘点 ----
  app.get("/api/skills", async (c) => {
    const projects = await discoverProjects(settings);
    const items = listSkills(paths.homeDir, paths.hostRoots, projects);
    return c.json({ items, projects });
  });

  return { app, paths, engine, settings, dataDir: paths.dataDir, homeDir: paths.homeDir, store, adapters, hashOf: sha1 };
}
