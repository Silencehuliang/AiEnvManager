import path from "node:path";
import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { makeFixtureHome, cleanupFixture } from "./helpers/fixture.js";

const DEV_PATCH = `# 我的开发插件 patch
- id: my-board
  name: dsh-matt-board
  disabled: false
  config:
    port: 3000
`;

async function setup() {
  const home = await makeFixtureHome();
  // 开发插件项目(含 cordis.patch.yml 标记)
  const devRoot = path.join(home, "workspace", "dev-plugin");
  await fs.mkdir(path.join(devRoot, ".agents"), { recursive: true });
  await fs.writeFile(path.join(devRoot, "cordis.patch.yml"), DEV_PATCH);
  await fs.writeFile(
    path.join(devRoot, "package.json"),
    JSON.stringify({ name: "dsh-matt-board", dsh: { bundle: { patch: "./cordis.patch.yml" } } }),
  );
  // profile:依赖了该包,patch 里有同名条目但 config 不同
  const profileDir = path.join(home, ".dsh", "profiles", "desktop");
  await fs.mkdir(profileDir, { recursive: true });
  await fs.writeFile(
    path.join(profileDir, "package.json"),
    JSON.stringify({ name: "dsh-profile-desktop", dependencies: { "dsh-matt-board": "file:../dev-plugin" } }),
  );
  await fs.writeFile(
    path.join(profileDir, "cordis.patch.yml"),
    "- id: my-board\n  name: dsh-matt-board\n  disabled: false\n  config:\n    port: 4000\n",
  );
  const dataDir = path.join(home, ".aienvmanager-data");
  const { app } = await createApp({ homeDir: home, dataDir });
  return { home, app };
}

describe("dsh 开发者视图(只读)", () => {
  it("识别开发项目、挂载状态与本地/已装条目 diff", async () => {
    const { home, app } = await setup();
    try {
      await app.request("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scanRoots: [path.join(home, "workspace")] }),
      });
      const res = await app.request("/api/dsh/dev");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        readonly: boolean;
        projects: {
          root: string;
          packageName: string | null;
          mountedIn: { profile: string; via: string }[];
          diffs: { id: string; profile: string; status: string }[];
          patchEntries: { id: string }[];
        }[];
      };
      expect(body.readonly).toBe(true);
      const proj = body.projects.find((p) => p.root.endsWith("dev-plugin"));
      expect(proj?.packageName).toBe("dsh-matt-board");
      expect(proj?.patchEntries[0]?.id).toBe("my-board");
      expect(proj?.mountedIn.some((m) => m.profile === "desktop")).toBe(true);
      expect(proj?.diffs).toEqual([
        { id: "my-board", profile: "desktop", status: "different" },
      ]);
    } finally {
      await cleanupFixture(home);
    }
  });
});
