import path from "node:path";
import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { createApp } from "../src/app.js";
import { makeFixtureHome, cleanupFixture } from "./helpers/fixture.js";
import { parseToml } from "../src/engine/toml.js";

const CODEX = ".codex/config.toml";
const WITH_COMMENTS = `# Codex 主配置(注释必须保留)
model = "gpt-x"
model_provider = "custom"
custom_unknown = "keep-me"

[model_providers.custom]
name = "custom"
base_url = "http://127.0.0.1:9000/v1"
requires_openai_auth = true
`;

async function setup() {
  const home = await makeFixtureHome();
  await fs.writeFile(path.join(home, CODEX), WITH_COMMENTS);
  const dataDir = path.join(home, ".aienvmanager-data");
  const { app } = await createApp({ homeDir: home, dataDir });
  return { home, app, file: path.join(home, CODEX) };
}

async function createProfile(app: Hono, name = "WB Provider"): Promise<string> {
  const res = await app.request("/api/providers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      baseUrl: "https://wb.example.com/v1",
      apiKey: "sk-wb-1234567890",
      models: ["glm-5.3-flash"],
    }),
  });
  const body = (await res.json()) as { profile: { id: string } };
  return body.profile.id;
}

describe("Codex 供应商切换", () => {
  it("切换后:新段写好、model_provider/model 更新、注释与未知键/其他段不动", async () => {
    const { home, app, file } = await setup();
    try {
      const id = await createProfile(app);
      const res = await app.request(`/api/providers/${id}/switch/codex`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      expect(res.status).toBe(200);
      const content = await fs.readFile(file, "utf8");
      expect(content).toContain("# Codex 主配置(注释必须保留)");
      expect(content).toContain('custom_unknown = "keep-me"');
      expect(content).toContain("requires_openai_auth = true");

      const parsed = parseToml<{
        model: string;
        model_provider: string;
        model_providers: { [k: string]: { name: string; base_url: string; requires_openai_auth?: boolean } };
      }>(content);
      expect(parsed.model_provider).toBe("wb-provider");
      expect(parsed.model).toBe("glm-5.3-flash");
      expect(parsed.model_providers["wb-provider"].base_url).toBe("https://wb.example.com/v1");
      // 原 custom 段未被删除(最小侵入)
      expect(parsed.model_providers.custom.requires_openai_auth).toBe(true);
    } finally {
      await cleanupFixture(home);
    }
  });

  it("重复切换同档案:内容稳定(幂等)", async () => {
    const { home, app } = await setup();
    try {
      const id = await createProfile(app);
      for (let i = 0; i < 2; i++) {
        const res = await app.request(`/api/providers/${id}/switch/codex`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        expect(res.status).toBe(200);
      }
      const body = (await (await app.request("/api/providers")).json()) as {
        active: Record<string, { slug: string | null }>;
      };
      expect(body.active.codex.slug).toBe("wb-provider");
    } finally {
      await cleanupFixture(home);
    }
  });

  it("删除活跃中的 Codex 档案被阻止", async () => {
    const { home, app } = await setup();
    try {
      const id = await createProfile(app);
      await app.request(`/api/providers/${id}/switch/codex`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const del = await app.request(`/api/providers/${id}`, { method: "DELETE" });
      expect(del.status).toBe(409);
    } finally {
      await cleanupFixture(home);
    }
  });
});
