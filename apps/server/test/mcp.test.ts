import path from "node:path";
import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { makeFixtureHome, cleanupFixture } from "./helpers/fixture.js";
import { parseJsonc } from "../src/engine/jsonc.js";
import { parseToml } from "../src/engine/toml.js";

const ZCODE_CONFIG = ".zcode/cli/config.json";
const CODEX_TOML = ".codex/config.toml";
const OPENCODE = ".config/opencode/opencode.json";

async function setup() {
  const home = await makeFixtureHome();
  await fs.writeFile(path.join(home, OPENCODE), '{\n  // opencode 注释\n  "model": "x/y"\n}');
  const dataDir = path.join(home, ".aienvmanager-data");
  const { app } = await createApp({ homeDir: home, dataDir });
  return { home, app };
}

describe("MCP 三宿主编辑 + dsh 只读", () => {
  it("列表:fixture 中 zcode/codex 的既有条目可见,dsh 只读", async () => {
    const { home, app } = await setup();
    try {
      const body = (await (await app.request("/api/mcp")).json()) as {
        hosts: Record<string, { readonly: boolean; entries: { name: string }[] }>;
      };
      expect(body.hosts.zcode.entries).toHaveLength(0);
      expect(body.hosts.codex.entries.some((e) => e.name === "demo")).toBe(true);
      expect(body.hosts.dsh.readonly).toBe(true);
      expect(body.hosts.opencode.entries).toHaveLength(0);
      void home;
    } finally {
      await cleanupFixture(home);
    }
  });

  it("新增:三宿主各写各的格式,注释保留", async () => {
    const { home, app } = await setup();
    try {
      for (const host of ["zcode", "codex", "opencode"]) {
        const res = await app.request(`/api/mcp/${host}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "added-srv", command: "npx -y added" }),
        });
        expect(res.status).toBe(200);
      }
      const zc = parseJsonc<{ mcp: { servers: Record<string, { command: string; enabled: boolean }> } }>(
        await fs.readFile(path.join(home, ZCODE_CONFIG), "utf8"),
      );
      expect(zc.mcp.servers["added-srv"].command).toBe("npx -y added");
      const cx = parseToml<{ mcp_servers: Record<string, { command: string }> }>(
        await fs.readFile(path.join(home, CODEX_TOML), "utf8"),
      );
      expect(cx.mcp_servers["added-srv"].command).toBe("npx -y added");
      const oc = parseJsonc<{ mcp: Record<string, { enabled: boolean }> }>(
        await fs.readFile(path.join(home, OPENCODE), "utf8"),
      );
      expect(oc.mcp["added-srv"].enabled).toBe(true);
      expect(await fs.readFile(path.join(home, OPENCODE), "utf8")).toContain("// opencode 注释");

      const dsh = await app.request("/api/mcp/dsh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "x", command: "y" }),
      });
      expect(dsh.status).toBe(403);
    } finally {
      await cleanupFixture(home);
    }
  });

  it("启停与删除:codex TOML enabled 标志 + removeTable", async () => {
    const { home, app } = await setup();
    try {
      const t1 = await app.request("/api/mcp/codex/demo/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
      expect(t1.status).toBe(200);
      const parsed = parseToml<{ mcp_servers: { demo: { enabled: boolean; command: string } } }>(
        await fs.readFile(path.join(home, CODEX_TOML), "utf8"),
      );
      expect(parsed.mcp_servers.demo.enabled).toBe(false);
      expect(parsed.mcp_servers.demo.command).toBe("demo-cmd");

      const del = await app.request("/api/mcp/codex/demo", { method: "DELETE" });
      expect(del.status).toBe(200);
      const after = parseToml<{ mcp_servers?: Record<string, unknown> }>(
        await fs.readFile(path.join(home, CODEX_TOML), "utf8"),
      );
      expect(after.mcp_servers?.demo).toBeUndefined();
    } finally {
      await cleanupFixture(home);
    }
  });
});
