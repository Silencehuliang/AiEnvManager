import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { makeFixtureHome, cleanupFixture } from "./helpers/fixture.js";

const requireSqlite = createRequire(import.meta.url) as (id: string) => typeof import("node:sqlite");

async function makeCcSwitchDb(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ccswitch-fixture-"));
  const dbPath = path.join(dir, "cc-switch.db");
  const { DatabaseSync } = requireSqlite("node:sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec(`CREATE TABLE providers (id TEXT, app_type TEXT, name TEXT, settings_config TEXT, is_current BOOLEAN);
CREATE TABLE provider_endpoints (provider_id TEXT, url TEXT);`);
  const ins = db.prepare("INSERT INTO providers VALUES (?,?,?,?,?)");
  ins.run("a1", "claude", "Claude A", JSON.stringify({ env: { ANTHROPIC_BASE_URL: "https://a.example.com", ANTHROPIC_AUTH_TOKEN: "sk-a-1234567890" } }), 1);
  ins.run("b1", "codex", "WB Proxy", JSON.stringify({ auth: { OPENAI_API_KEY: "sk-b-1234567890" }, config: '[model_providers.custom]\nbase_url = "http://127.0.0.1:7863/v1"\n' }), 0);
  ins.run("c1", "codex", "NoKey", JSON.stringify({ auth: {}, config: "" }), 0);
  db.prepare("INSERT INTO provider_endpoints VALUES (?,?)").run("b1", "https://real.example.com/v1");
  db.close();
  return dbPath;
}

describe("cc-switch 档案导入", () => {
  it("claude 直取 env;codex 本地代理回退 provider_endpoints;缺 key 跳过;种子入库", async () => {
    const home = await makeFixtureHome();
    try {
      const dbPath = await makeCcSwitchDb();
      const dataDir = path.join(home, ".aienvmanager-data");
      const { app } = await createApp({ homeDir: home, dataDir });

      const res = await app.request("/api/providers/import-ccswitch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dbPath }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { total: number; imported: number; skipped: number; skippedNotes: string[] };
      expect(body.total).toBe(3);
      expect(body.imported).toBe(2);
      expect(body.skipped).toBe(1);
      expect(body.skippedNotes[0]).toContain("NoKey");

      const listRes = await app.request("/api/providers");
      const list = (await listRes.json()) as {
        profiles: { name: string; baseUrl: string; apiKey: string }[];
      };
      const a = list.profiles.find((p) => p.name === "Claude A");
      expect(a?.baseUrl).toBe("https://a.example.com");
      expect(a?.apiKey).toContain("****");
      const b = list.profiles.find((p) => p.name === "WB Proxy");
      expect(b?.baseUrl).toBe("https://real.example.com/v1");

      // 幂等:重复导入不再增加
      const again = await app.request("/api/providers/import-ccswitch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dbPath }),
      });
      const againBody = (await again.json()) as { imported: number };
      expect(againBody.imported).toBe(0);
    } finally {
      await cleanupFixture(home);
    }
  });

  it("数据库不存在 → 400", async () => {
    const home = await makeFixtureHome();
    try {
      const { app } = await createApp({ homeDir: home, dataDir: path.join(home, ".d") });
      const res = await app.request("/api/providers/import-ccswitch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dbPath: "Z:/nope/cc-switch.db" }),
      });
      expect(res.status).toBe(400);
    } finally {
      await cleanupFixture(home);
    }
  });
});
