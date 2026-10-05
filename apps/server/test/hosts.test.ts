import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { makeFixtureHome, cleanupFixture } from "./helpers/fixture.js";

describe("GET /api/hosts", () => {
  it("在 fixture 假环境中探测到全部四家宿主,配置路径位于临时目录下", async () => {
    const home = await makeFixtureHome();
    try {
      const { app } = await createApp({ homeDir: home });
      const res = await app.request("/api/hosts");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.hosts.map((h: { id: string }) => h.id)).toEqual([
        "zcode",
        "codex",
        "opencode",
        "dsh",
      ]);
      for (const host of body.hosts) {
        expect(host.detected).toBe(true);
        expect(host.root.startsWith(home)).toBe(true);
        expect(host.configPaths.length).toBeGreaterThan(0);
        for (const p of host.configPaths) expect(p.startsWith(home)).toBe(true);
      }
    } finally {
      await cleanupFixture(home);
    }
  });

  it("空主目录下四家宿主均为未安装", async () => {
    const home = await makeFixtureHome();
    // 清空宿主目录,只留 home 本身
    const { rm } = await import("node:fs/promises");
    const path = await import("node:path");
    for (const d of [".zcode", ".codex", ".config", ".dsh"]) {
      await rm(path.join(home, d), { recursive: true, force: true });
    }
    try {
      const { app } = await createApp({ homeDir: home });
      const res = await app.request("/api/hosts");
      const body = await res.json();
      expect(body.hosts.every((h: { detected: boolean }) => h.detected === false)).toBe(true);
    } finally {
      await cleanupFixture(home);
    }
  });
});
