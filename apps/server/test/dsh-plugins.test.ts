import path from "node:path";
import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { makeFixtureHome, cleanupFixture } from "./helpers/fixture.js";

const PATCH = ".dsh/profiles/desktop/cordis.patch.yml";
const PATCH_CONTENT = `# desktop profile patch
- id: timer
  name: '@deepseek-ai/cordis-plugin-timer'
- id: hmr
  disabled: true
`;

async function setup() {
  const home = await makeFixtureHome();
  await fs.writeFile(path.join(home, ".dsh/profiles/desktop/package.json"), JSON.stringify({
    name: "dsh-profile-desktop",
    dsh: { profile: { bundles: ["@deepseek-ai/dsh-base"] } },
  }));
  await fs.writeFile(path.join(home, PATCH), PATCH_CONTENT);
  const dataDir = path.join(home, ".aienvmanager-data");
  const { app } = await createApp({ homeDir: home, dataDir });
  return { home, app };
}

describe("dsh 插件组合树 + 启停", () => {
  it("组合树:bundles 基础层 + patch 条目(含 disabled 与托管态)", async () => {
    const { home, app } = await setup();
    try {
      const body = (await (await app.request("/api/dsh/profiles")).json()) as {
        profiles: { name: string; bundles: string[]; entries: { id: string; disabled: boolean; managed: boolean }[] }[];
      };
      const desktop = body.profiles.find((p) => p.name === "desktop");
      expect(desktop?.bundles).toEqual(["@deepseek-ai/dsh-base"]);
      expect(desktop?.entries.find((e) => e.id === "timer")?.disabled).toBe(false);
      expect(desktop?.entries.find((e) => e.id === "hmr")?.disabled).toBe(true);
      expect(desktop?.entries.find((e) => e.id === "hmr")?.managed).toBe(false);
      void home;
    } finally {
      await cleanupFixture(home);
    }
  });

  it("启停:patch 条目 upsert,注释与既有条目保留;托管态翻转", async () => {
    const { home, app } = await setup();
    try {
      const res = await app.request("/api/dsh/profiles/desktop/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pluginId: "timer", disabled: true }),
      });
      expect(res.status).toBe(200);
      const content = await fs.readFile(path.join(home, PATCH), "utf8");
      expect(content).toContain("# desktop profile patch");
      expect(content).toContain("disabled: true");

      const body = (await (await app.request("/api/dsh/profiles")).json()) as {
        profiles: { name: string; entries: { id: string; disabled: boolean; managed: boolean }[] }[];
      };
      const desktop = body.profiles.find((p) => p.name === "desktop");
      expect(desktop?.entries.find((e) => e.id === "timer")?.disabled).toBe(true);
      expect(desktop?.entries.find((e) => e.id === "timer")?.managed).toBe(true);

      // 重新启用既有条目
      const res2 = await app.request("/api/dsh/profiles/desktop/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pluginId: "hmr", disabled: false }),
      });
      expect(res2.status).toBe(200);
      const after = (await (await app.request("/api/dsh/profiles")).json()) as {
        profiles: { entries: { id: string; disabled: boolean }[] }[];
      };
      expect(after.profiles[0].entries.find((e) => e.id === "hmr")?.disabled).toBe(false);
    } finally {
      await cleanupFixture(home);
    }
  });
});
