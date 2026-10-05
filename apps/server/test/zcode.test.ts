import path from "node:path";
import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { createApp } from "../src/app.js";
import { makeFixtureHome, cleanupFixture } from "./helpers/fixture.js";
import { parseJsonc } from "../src/engine/jsonc.js";

const RULES = ".zcode/provider_config.json";
const REGISTRY = ".zcode/config.json";
const SETTING = ".zcode/setting.json";

const RULES_CONTENT = `{
  // ZCode provider 规则(注释保留)
  "schemaVersion": 1,
  "config": {
    "providerOrder": ["145b8744-96cb-4903-adfd-907e9b4b9180"],
    "providerConfigRules": {
      "providerRules": [
        {
          "providerId": "145b8744-96cb-4903-adfd-907e9b4b9180",
          "providerName": "sensenova",
          "config": {
            "access": { "type": "api-key", "apiKey": "sk-sensenova" },
            "api": { "type": "openai", "baseUrl": "https://old" },
            "personalModelIds": ["deepseek-v4.1-flash"]
          }
        }
      ]
    }
  }
}`;
const REGISTRY_CONTENT = `{
  // ZCode provider 注册表
  "provider": {
    "builtin:zai": { "name": "ZAI", "enabled": true, "models": { "GLM-5.3": {} } }
  }
}`;

async function setup() {
  const home = await makeFixtureHome();
  await fs.mkdir(path.join(home, ".zcode"), { recursive: true });
  await fs.writeFile(path.join(home, RULES), RULES_CONTENT);
  await fs.writeFile(path.join(home, REGISTRY), REGISTRY_CONTENT);
  const dataDir = path.join(home, ".aienvmanager-data");
  const { app } = await createApp({ homeDir: home, dataDir });
  return { home, app };
}

async function createProfile(app: Hono): Promise<string> {
  const res = await app.request("/api/providers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "WB Provider",
      baseUrl: "https://wb.example.com/v1",
      apiKey: "sk-wb-1234567890",
      models: ["glm-5.3-flash"],
    }),
  });
  const body = (await res.json()) as { profile: { id: string } };
  return body.profile.id;
}

describe("ZCode 供应商切换(spike 后)", () => {
  it("三文件写入:规则 upsert+order、注册表条目、激活键;注释与既有规则保留", async () => {
    const { home, app } = await setup();
    try {
      const id = await createProfile(app);
      const res = await app.request(`/api/providers/${id}/switch/zcode`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      expect(res.status).toBe(200);

      const rules = parseJsonc<{
        config: { providerOrder: string[]; providerConfigRules: { providerRules: { providerId: string; providerName: string; config: { access: { apiKey: string }; api: { baseUrl: string }; personalModelIds: string[] } }[] } };
      }>(await fs.readFile(path.join(home, RULES), "utf8"));
      expect(RULES_CONTENT.startsWith("{\n  // ZCode provider 规则(注释保留)")).toBe(true);
      const rule = rules.config.providerConfigRules.providerRules.find((r) => r.providerId === "wb-provider");
      expect(rule?.config.access.apiKey).toBe("sk-wb-1234567890");
      expect(rule?.config.api.baseUrl).toBe("https://wb.example.com/v1");
      expect(rule?.config.personalModelIds).toEqual(["glm-5.3-flash"]);
      expect(rules.config.providerOrder[0]).toBe("wb-provider");
      // 既有规则保留
      expect(rules.config.providerConfigRules.providerRules.some((r) => r.providerName === "sensenova")).toBe(true);

      const registry = parseJsonc<{ provider: Record<string, { options: { baseURL: string }; enabled: boolean; models: Record<string, object> }> }>(
        await fs.readFile(path.join(home, REGISTRY), "utf8"),
      );
      expect(registry.provider["wb-provider"].options.baseURL).toBe("https://wb.example.com/v1");
      expect(registry.provider["wb-provider"].enabled).toBe(true);
      expect(Object.keys(registry.provider["wb-provider"].models)).toEqual(["glm-5.3-flash"]);
      expect(registry.provider["builtin:zai"]).toBeTruthy();

      const setting = parseJsonc<{ modelProviderFamilySelectedKeys: { zai: string } }>(
        await fs.readFile(path.join(home, SETTING), "utf8"),
      );
      expect(setting.modelProviderFamilySelectedKeys.zai).toBe("wb-provider");

      // readActive 兼容 kind 前缀格式
      await fs.writeFile(
        path.join(home, SETTING),
        JSON.stringify({ modelProviderFamilySelectedKeys: { zai: "coding-plan:wb-provider" } }),
      );
      const list = (await (await app.request("/api/providers")).json()) as {
        active: Record<string, { slug: string | null }>;
      };
      expect(list.active.zcode.slug).toBe("wb-provider");
    } finally {
      await cleanupFixture(home);
    }
  });
});
