import path from "node:path";
import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { makeFixtureHome, cleanupFixture } from "./helpers/fixture.js";

const SKILL_MD = `---
name: my-skill
description: 一个用于测试的技能
---

# 用法
做点什么。
`;

async function setup() {
  const home = await makeFixtureHome();
  const project = path.join(home, "workspace", "demo-proj");
  await fs.mkdir(path.join(project, ".agents", "skills"), { recursive: true });
  // 用户全局层:共享 .agents
  await fs.mkdir(path.join(home, ".agents", "skills", "brain"), { recursive: true });
  await fs.writeFile(path.join(home, ".agents", "skills", "brain", "SKILL.md"), SKILL_MD);
  // 用户全局层:opencode 自有
  await fs.mkdir(path.join(home, ".config", "opencode", "skills", "oc-only"), { recursive: true });
  await fs.writeFile(path.join(home, ".config", "opencode", "skills", "oc-only", "SKILL.md"), SKILL_MD);
  // 内置层:ZCode 插件缓存
  const cache = path.join(home, ".zcode", "cli", "plugins", "cache", "market", "org", "1.0.0", "skills", "cached-skill");
  await fs.mkdir(cache, { recursive: true });
  await fs.writeFile(path.join(cache, "SKILL.md"), SKILL_MD);
  // 项目层
  await fs.mkdir(path.join(project, ".agents", "skills", "proj-skill"), { recursive: true });
  await fs.writeFile(path.join(project, ".agents", "skills", "proj-skill", "SKILL.md"), SKILL_MD);
  // 项目外的干扰目录(无标记,不该被发现)
  await fs.mkdir(path.join(home, "workspace", "plain-dir"), { recursive: true });

  const dataDir = path.join(home, ".aienvmanager-data");
  const { app, settings } = await createApp({ homeDir: home, dataDir });
  return { home, app, settings, project };
}

describe("Skills 三层盘点 + 项目扫描", () => {
  it("扫描根发现含标记的项目;排除项生效", async () => {
    const { home, app, project } = await setup();
    try {
      await app.request("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scanRoots: [path.join(home, "workspace")] }),
      });
      let body = (await (await app.request("/api/skills")).json()) as { projects: { root: string }[] };
      expect(body.projects.map((p) => p.root)).toContain(project);

      await app.request("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ excludes: [project] }),
      });
      body = (await (await app.request("/api/skills")).json()) as { projects: { root: string }[] };
      expect(body.projects).toHaveLength(0);
    } finally {
      await cleanupFixture(home);
    }
  });

  it("三层 skills:层级、宿主引用、描述正确;内置层只读语义由层级表达", async () => {
    const { home, app, project } = await setup();
    try {
      await app.request("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scanRoots: [path.join(home, "workspace")] }),
      });
      const body = (await (await app.request("/api/skills")).json()) as {
        items: { name: string; layer: string; hosts: string[]; description?: string; project?: string }[];
      };
      const byName = (n: string) => body.items.find((i) => i.name === n);

      const brain = byName("brain");
      expect(brain?.layer).toBe("user");
      expect(brain?.hosts).toEqual(["zcode", "codex", "opencode"]);
      expect(brain?.description).toBe("一个用于测试的技能");

      const oc = byName("oc-only");
      expect(oc?.hosts).toEqual(["opencode"]);

      const cached = byName("cached-skill");
      expect(cached?.layer).toBe("builtin");
      expect(cached?.hosts).toEqual(["zcode"]);

      const proj = byName("proj-skill");
      expect(proj?.layer).toBe("project");
      expect(proj?.project).toBe(project);
    } finally {
      await cleanupFixture(home);
    }
  });
});
