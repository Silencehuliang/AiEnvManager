import path from "node:path";
import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { makeFixtureHome, cleanupFixture } from "./helpers/fixture.js";

async function setup() {
  const home = await makeFixtureHome();
  const dataDir = path.join(home, ".aienvmanager-data");
  const calls: { cmd: string; args: string[]; cwd: string }[] = [];
  const { app } = await createApp({
    homeDir: home,
    dataDir,
    dshRunner: async (cmd, args, cwd) => {
      calls.push({ cmd, args, cwd });
      return { stdout: `ran: ${args.join(" ")}`, stderr: "" };
    },
  });
  return { home, app, calls };
}

describe("dsh 插件全生命周期(代跑 dsh plugin)", () => {
  it("fake runner 断言命令/cwd/profile;安装命令正确转发", async () => {
    const { home, app, calls } = await setup();
    try {
      const res = await app.request("/api/dsh/profiles/desktop/plugins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ args: ["add", "@scope/my-plugin"] }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; command: string[]; cwd: string };
      expect(body.ok).toBe(true);
      expect(body.command).toEqual(["dsh", "plugin", "--profile", "desktop", "add", "@scope/my-plugin"]);
      expect(body.cwd).toBe(path.join(home, ".dsh", "profiles", "desktop"));
      expect(calls.length).toBe(1);
      expect(calls[0].args).toContain("@scope/my-plugin");
    } finally {
      await cleanupFixture(home);
    }
  });

  it("卸载/升级同样转发;非法动词被拒;dry-run 不执行", async () => {
    const { home, app, calls } = await setup();
    try {
      for (const verb of ["remove", "update"]) {
        const res = await app.request("/api/dsh/profiles/desktop/plugins", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ args: [verb, "pkg"] }),
        });
        expect(res.status).toBe(200);
      }
      const bad = await app.request("/api/dsh/profiles/desktop/plugins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ args: ["rm", "pkg"] }),
      });
      expect(bad.status).toBe(400);

      const dry = await app.request("/api/dsh/profiles/desktop/plugins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ args: ["add", "pkg"], dryRun: true }),
      });
      const dryBody = (await dry.json()) as { dryRun: boolean };
      expect(dryBody.dryRun).toBe(true);
      expect(calls.filter((c) => c.args[0] === "add").length).toBe(0);
    } finally {
      await cleanupFixture(home);
    }
  });

  it("不存在的 profile → 404", async () => {
    const { home, app } = await setup();
    try {
      const res = await app.request("/api/dsh/profiles/nope/plugins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ args: ["add", "pkg"] }),
      });
      expect(res.status).toBe(404);
    } finally {
      await cleanupFixture(home);
    }
  });
});
