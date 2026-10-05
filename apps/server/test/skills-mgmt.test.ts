import path from "node:path";
import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { makeFixtureHome, cleanupFixture } from "./helpers/fixture.js";

const SKILL_MD = "---\nname: demo\ndescription: demo skill\n---\n# t\n";

async function setup() {
  const home = await makeFixtureHome();
  const skillDir = path.join(home, ".agents", "skills", "demo");
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, "SKILL.md"), SKILL_MD);
  await fs.writeFile(path.join(home, ".agents", ".skill-lock.json"), JSON.stringify({ version: 3, skills: {}, dismissed: {} }, null, 2));
  const dataDir = path.join(home, ".aienvmanager-data");
  const { app } = await createApp({ homeDir: home, dataDir });
  return { home, app, skillDir };
}

describe("Skills 启停/安装/复制", () => {
  it("禁用:目录移入 .disabled,lock 同步;列表 disabled=true 且托管态", async () => {
    const { home, app, skillDir } = await setup();
    try {
      const list1 = (await (await app.request("/api/skills")).json()) as { items: { id: string; name: string; disabled: boolean; provenance: string }[] };
      const item = list1.items.find((i) => i.name === "demo");
      expect(item?.disabled).toBe(false);

      const res = await app.request("/api/skills/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item!.id, enabled: false }),
      });
      expect(res.status).toBe(200);
      expect(await fs.readFile(path.join(home, ".agents", ".skill-lock.json"), "utf8")).toContain('"disabled": true');
      // 原目录已移走
      const exists = fs.stat(skillDir).then(() => true, () => false);
      expect(await exists).toBe(false);

      const list2 = (await (await app.request("/api/skills")).json()) as { items: { id: string; name: string; disabled: boolean; provenance: string }[] };
      const item2 = list2.items.find((i) => i.name === "demo");
      expect(item2?.disabled).toBe(true);
      expect(item2?.provenance).toBe("managed");

      // 重新启用
      const res2 = await app.request("/api/skills/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item2!.id, enabled: true }),
      });
      expect(res2.status).toBe(200);
      const existsBack = fs.stat(skillDir).then(() => true, () => false);
      expect(await existsBack).toBe(true);
    } finally {
      await cleanupFixture(home);
    }
  });

  it("内置层禁止启停(403)", async () => {
    const { home, app } = await setup();
    try {
      const cache = path.join(home, ".zcode", "cli", "plugins", "cache", "m", "o", "1.0.0", "skills", "b");
      await fs.mkdir(cache, { recursive: true });
      await fs.writeFile(path.join(cache, "SKILL.md"), SKILL_MD);
      const list = (await (await app.request("/api/skills")).json()) as { items: { id: string; layer: string }[] };
      const b = list.items.find((i) => i.layer === "builtin");
      const res = await app.request("/api/skills/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: b!.id, enabled: false }),
      });
      expect(res.status).toBe(403);
    } finally {
      await cleanupFixture(home);
    }
  });

  it("从本地目录安装到项目层", async () => {
    const { home, app } = await setup();
    try {
      const src = path.join(home, "src-skill");
      await fs.mkdir(src, { recursive: true });
      await fs.writeFile(path.join(src, "SKILL.md"), SKILL_MD);
      const project = path.join(home, "workspace", "proj");
      await fs.mkdir(path.join(project, ".agents"), { recursive: true });
      await app.request("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scanRoots: [path.join(home, "workspace")] }),
      });
      const res = await app.request("/api/skills/install", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: src, targetLayer: "project", project, name: "installed" }),
      });
      expect(res.status).toBe(200);
      const list = (await (await app.request("/api/skills")).json()) as { items: { name: string; layer: string }[] };
      expect(list.items.some((i) => i.name === "installed" && i.layer === "project")).toBe(true);
    } finally {
      await cleanupFixture(home);
    }
  });

  it("复制用户层到项目层", async () => {
    const { home, app } = await setup();
    try {
      const project = path.join(home, "workspace", "proj");
      await fs.mkdir(path.join(project, ".agents"), { recursive: true });
      await app.request("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scanRoots: [path.join(home, "workspace")] }),
      });
      const list1 = (await (await app.request("/api/skills")).json()) as { items: { id: string; layer: string; name: string }[] };
      const item = list1.items.find((i) => i.name === "demo" && i.layer === "user");
      const res = await app.request("/api/skills/copy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item!.id, toLayer: "project", project }),
      });
      expect(res.status).toBe(200);
      const list2 = (await (await app.request("/api/skills")).json()) as { items: { name: string; layer: string }[] };
      expect(list2.items.filter((i) => i.name === "demo").length).toBe(2);
    } finally {
      await cleanupFixture(home);
    }
  });
});
