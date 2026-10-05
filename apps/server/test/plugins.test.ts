import path from "node:path";
import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { makeFixtureHome, cleanupFixture } from "./helpers/fixture.js";
import { parseJsonc } from "../src/engine/jsonc.js";
import { parseToml } from "../src/engine/toml.js";

const IPJ = ".zcode/cli/plugins/installed_plugins.json";
const ZCFG = ".zcode/cli/config.json";
const CXT = ".codex/config.toml";
const OC = ".config/opencode/opencode.json";

async function setup() {
  const home = await makeFixtureHome();
  await fs.mkdir(path.join(home, ".zcode", "cli", "plugins"), { recursive: true });
  await fs.writeFile(
    path.join(home, IPJ),
    JSON.stringify(
      { version: 1, plugins: [{ id: "a@market", name: "a", marketplace: "market", version: "1.0.0" }] },
      null,
      2,
    ),
  );
  await fs.writeFile(path.join(home, ZCFG), '{ "plugins": { "enabledPlugins": ["a@market"] } }');
  await fs.writeFile(
    path.join(home, CXT),
    `[plugins."b@src"]\nenabled = true\n`,
  );
  await fs.writeFile(path.join(home, OC), '{\n  // oc 注释\n  "plugin": ["oc-plugin"]\n}');
  const dataDir = path.join(home, ".aienvmanager-data");
  const { app } = await createApp({ homeDir: home, dataDir });
  return { home, app };
}

describe("插件域(三家)", () => {
  it("清单:三家条目与启用态正确", async () => {
    const { home, app } = await setup();
    try {
      const body = (await (await app.request("/api/plugins")).json()) as {
        hosts: Record<string, { entries: { id: string; enabled: boolean }[] }>;
      };
      expect(body.hosts.zcode.entries[0]?.id).toBe("a@market");
      expect(body.hosts.zcode.entries[0]?.enabled).toBe(true);
      expect(body.hosts.codex.entries[0]).toEqual({ id: "b@src", enabled: true });
      expect(body.hosts.opencode.entries[0]).toEqual({ id: "oc-plugin", enabled: true });
      void home;
    } finally {
      await cleanupFixture(home);
    }
  });

  it("启停:ZCode 白名单增删 / Codex enabled 标志 / OpenCode 数组增删", async () => {
    const { home, app } = await setup();
    try {
      await app.request("/api/plugins/zcode/a%40market/toggle", { method: "POST" });
      const zc = parseJsonc<{ plugins: { enabledPlugins: string[] } }>(
        await fs.readFile(path.join(home, ZCFG), "utf8"),
      );
      expect(zc.plugins.enabledPlugins).not.toContain("a@market");
      await app.request("/api/plugins/zcode/a%40market/toggle", { method: "POST" });
      const zc2 = parseJsonc<{ plugins: { enabledPlugins: string[] } }>(
        await fs.readFile(path.join(home, ZCFG), "utf8"),
      );
      expect(zc2.plugins.enabledPlugins).toContain("a@market");

      await app.request("/api/plugins/codex/b%40src/toggle", { method: "POST" });
      const cx = parseToml<{ plugins: { "b@src": { enabled: boolean } } }>(
        await fs.readFile(path.join(home, CXT), "utf8"),
      );
      expect(cx.plugins["b@src"].enabled).toBe(false);

      await app.request("/api/plugins/opencode/oc-plugin/toggle", { method: "POST" });
      const oc = parseJsonc<{ plugin: string[] }>(await fs.readFile(path.join(home, OC), "utf8"));
      expect(oc.plugin).not.toContain("oc-plugin");
    } finally {
      await cleanupFixture(home);
    }
  });

  it("dsh 插件域只读", async () => {
    const { home, app } = await setup();
    try {
      const res = await app.request("/api/plugins/dsh/x/toggle", { method: "POST" });
      expect(res.status).toBe(403);
    } finally {
      await cleanupFixture(home);
    }
  });
});
