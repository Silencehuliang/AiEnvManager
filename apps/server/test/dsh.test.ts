import path from "node:path";
import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { createApp } from "../src/app.js";
import { makeFixtureHome, cleanupFixture } from "./helpers/fixture.js";
import { parse as parseYamlText } from "yaml";

const SETTINGS = ".dsh/settings.yaml";
const IMPORTED = ".dsh/settings.yaml.imported";
const CRED = ".dsh/.credentials.yaml";
const IMPORTED_CONTENT = `# dsh legacy 设置(播种用)
ui-theme:
  preference: dark
llm-deepseek:
  baseURL: https://api.deepseek.com
  models: [deepseek-chat]
agent-default-model:
  provider: deepseek
  model: deepseek-chat
`;
const CRED_CONTENT = `version: 1
refs:
  env-example: DEEPSEEK_API_KEY
records:
  dsh-llm/deepseek:
    kind: api-key
    key: sk-existing
    env: DEEPSEEK_API_KEY
`;

async function setup(withImported = true) {
  const home = await makeFixtureHome();
  if (withImported) {
    await fs.writeFile(path.join(home, IMPORTED), IMPORTED_CONTENT);
  }
  await fs.writeFile(path.join(home, CRED), CRED_CONTENT);
  const dataDir = path.join(home, ".aienvmanager-data");
  const { app } = await createApp({ homeDir: home, dataDir });
  return { home, app };
}

async function createProfile(app: Hono): Promise<string> {
  const res = await app.request("/api/providers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "WB Gateway",
      baseUrl: "https://wb.example.com/v1",
      apiKey: "sk-wb-9876543210",
      models: ["glm-5.3-flash"],
    }),
  });
  const body = (await res.json()) as { profile: { id: string } };
  return body.profile.id;
}

describe("dsh 供应商切换", () => {
  it("从 .imported 播种 settings.yaml 并写入 provider + 默认模型;凭据写入 records;refs 与既有记录不动", async () => {
    const { home, app } = await setup();
    try {
      const id = await createProfile(app);
      const res = await app.request(`/api/providers/${id}/switch/dsh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      expect(res.status).toBe(200);

      const settings = await fs.readFile(path.join(home, SETTINGS), "utf8");
      expect(settings).toContain("# dsh legacy 设置(播种用)");
      const parsed = parseYamlText(settings) as {
        "llm-wb-gateway": { baseURL: string; models: string[] };
        "agent-default-model": { provider: string; model: string };
        "ui-theme": { preference: string };
      };
      expect(parsed["llm-wb-gateway"].baseURL).toBe("https://wb.example.com/v1");
      expect(parsed["llm-wb-gateway"].models).toEqual(["glm-5.3-flash"]);
      expect(parsed["agent-default-model"].provider).toBe("wb-gateway");
      expect(parsed["agent-default-model"].model).toBe("glm-5.3-flash");
      expect(parsed["ui-theme"].preference).toBe("dark");

      const cred = parseYamlText(await fs.readFile(path.join(home, CRED), "utf8")) as {
        version: number;
        refs: Record<string, string>;
        records: Record<string, { kind: string; key: string; env: string }>;
      };
      expect(cred.version).toBe(1);
      expect(cred.refs["env-example"]).toBe("DEEPSEEK_API_KEY");
      expect(cred.records["dsh-llm/deepseek"].key).toBe("sk-existing");
      const rec = cred.records["dsh-llm/wb-gateway"];
      expect(rec.kind).toBe("api-key");
      expect(rec.key).toBe("sk-wb-9876543210");
      expect(rec.env).toBe("DSH_LLM_WB_GATEWAY_API_KEY");
    } finally {
      await cleanupFixture(home);
    }
  });

  it("切换后 readActive 反映新 provider;列表 active 含 dsh", async () => {
    const { home, app } = await setup();
    try {
      const id = await createProfile(app);
      await app.request(`/api/providers/${id}/switch/dsh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const list = (await (await app.request("/api/providers")).json()) as {
        active: Record<string, { slug: string | null }>;
      };
      expect(list.active.dsh.slug).toBe("wb-gateway");
    } finally {
      await cleanupFixture(home);
    }
  });

  it("无 .imported 且无 settings.yaml:播种最小空表", async () => {
    const { home, app } = await setup(false);
    try {
      const id = await createProfile(app);
      const res = await app.request(`/api/providers/${id}/switch/dsh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      expect(res.status).toBe(200);
      const parsed = parseYamlText(await fs.readFile(path.join(home, SETTINGS), "utf8")) as {
        "agent-default-model": { provider: string };
      };
      expect(parsed["agent-default-model"].provider).toBe("wb-gateway");
    } finally {
      await cleanupFixture(home);
    }
  });
});
