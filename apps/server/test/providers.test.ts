import path from "node:path";
import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { makeFixtureHome, cleanupFixture } from "./helpers/fixture.js";
import { parseJsonc } from "../src/engine/jsonc.js";

const OPENCODE = ".config/opencode/opencode.json";
const WITH_COMMENT = `{
  // OpenCode 主配置(注释必须保留)
  "$schema": "https://opencode.ai/config.json",
  "model": "modelscope/glm-4.6",
  "provider": {
    "modelscope": {
      "options": { "baseURL": "https://old-url", "apiKey": "sk-old" },
      "models": { "glm-4.6": {} }
    }
  },
  "unknown_future_key": true
}`;

async function setup() {
  const home = await makeFixtureHome();
  await fs.writeFile(path.join(home, OPENCODE), WITH_COMMENT);
  const dataDir = path.join(home, ".aienvmanager-data");
  const ctx = await createApp({ homeDir: home, dataDir });
  return { home, ctx, file: path.join(home, OPENCODE) };
}

describe("供应商档案库 + OpenCode 切换", () => {
  it("创建档案:key 打码返回,列表不泄露完整 key", async () => {
    const { home, ctx } = await setup();
    try {
      const res = await ctx.app.request("/api/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "ModelScope",
          baseUrl: "https://api-inference.modelscope.cn/v1",
          apiKey: "sk-secret-1234567890",
          models: ["ZhipuAI/glm-4.6", "Qwen/qwen3-coder"],
        }),
      });
      expect(res.status).toBe(200);
      const { profile } = (await res.json()) as { profile: { apiKey: string; id: string } };
      expect(profile.apiKey).toContain("****");
      expect(profile.apiKey).not.toContain("secret-1234567890");

      const list = await ctx.app.request("/api/providers");
      const body = (await list.json()) as { profiles: { apiKey: string }[] };
      expect(body.profiles[0].apiKey).not.toContain("secret-1234567890");
    } finally {
      await cleanupFixture(home);
    }
  });

  it("预览切换:返回文件与操作清单,但不写盘", async () => {
    const { home, ctx, file } = await setup();
    try {
      const id = await createProfile(ctx.app);
      const res = await ctx.app.request(`/api/providers/${id}/preview/opencode`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { file: string; ops: unknown[]; effectModel: string };
      expect(body.ops.length).toBeGreaterThan(0);
      expect(body.effectModel).toBe("restart");
      // 未写盘
      expect(await fs.readFile(file, "utf8")).toBe(WITH_COMMENT);
    } finally {
      await cleanupFixture(home);
    }
  });

  it("切换 OpenCode:登记 provider + 激活 model,注释与未知键保留,生成备份", async () => {
    const { home, ctx, file } = await setup();
    try {
      const id = await createProfile(ctx.app);
      const res = await ctx.app.request(`/api/providers/${id}/switch/opencode`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
      const content = await fs.readFile(file, "utf8");
      expect(content).toContain("// OpenCode 主配置(注释必须保留)");
      expect(content).toContain('"unknown_future_key": true');
      expect(content).toContain('"baseURL": "https://api-inference.modelscope.cn/v1"');
      const parsed = parseJsonc<{ model: string; provider: Record<string, object> }>(content);
      expect(parsed.model).toBe("modelscope/ZhipuAI/glm-4.6".replace("modelscope/", "modelscope/"));
      expect(parsed.model.startsWith("modelscope/")).toBe(true);
      expect(Object.keys(parsed.provider)).toContain("modelscope");

      // 备份存在
      const list = await ctx.app.request(`/api/config/backups?path=${encodeURIComponent(file)}`);
      const body = (await list.json()) as { entries: unknown[] };
      expect(body.entries.length).toBe(1);
    } finally {
      await cleanupFixture(home);
    }
  });

  it("活跃中的档案不可删除;切走后可以删", async () => {
    const { home, ctx } = await setup();
    try {
      const idA = await createProfile(ctx.app, "Provider A");
      // 切换 A → A 成为活跃供应商
      await ctx.app.request(`/api/providers/${idA}/switch/opencode`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const del = await ctx.app.request(`/api/providers/${idA}`, { method: "DELETE" });
      expect(del.status).toBe(409);

      const idB = await createProfile(ctx.app, "Provider B");
      await ctx.app.request(`/api/providers/${idB}/switch/opencode`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const delA = await ctx.app.request(`/api/providers/${idA}`, { method: "DELETE" });
      expect(delA.status).toBe(200);
    } finally {
      await cleanupFixture(home);
    }
  });

  it("未实现适配器的宿主返回 404", async () => {
    const { home, ctx } = await setup();
    try {
      const id = await createProfile(ctx.app);
      const res = await ctx.app.request(`/api/providers/${id}/switch/zcode`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      expect(res.status).toBe(404);
    } finally {
      await cleanupFixture(home);
    }
  });
});

async function createProfile(app: { request: (u: string, i?: RequestInit) => Promise<Response> }, name = "ModelScope"): Promise<string> {
  const res = await app.request("/api/providers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      baseUrl: "https://api-inference.modelscope.cn/v1",
      apiKey: "sk-secret-1234567890",
      models: ["ZhipuAI/glm-4.6"],
    }),
  });
  const body = (await res.json()) as { profile: { id: string } };
  return body.profile.id;
}
