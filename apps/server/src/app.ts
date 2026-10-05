import path from "node:path";
import { existsSync } from "node:fs";
import { Hono } from "hono";
import type { HostInfo, HostsResponse } from "@aienv/shared";
import { HOST_DEFS, resolvePaths } from "./paths.js";

export interface AppOptions {
  /** 覆盖用户主目录(fixture 测试注入点) */
  homeDir?: string;
  /** 覆盖本工具数据目录(默认 ~/.aienvmanager) */
  dataDir?: string;
}

export function createApp(opts: AppOptions = {}) {
  const paths = resolvePaths(opts.homeDir);
  if (opts.dataDir) paths.dataDir = opts.dataDir;

  const app = new Hono();

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

  app.get("/api/health", (c) => c.json({ ok: true }));

  return { app, paths };
}
