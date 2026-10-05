import path from "node:path";
import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { makeFixtureHome, cleanupFixture } from "./helpers/fixture.js";

const CONFIG = ".zcode/cli/config.json";

describe("写盘事务(API 缝)", () => {
  it("补丁写回:内容变更 + 生成备份 + 可恢复", async () => {
    const home = await makeFixtureHome();
    try {
      const { app } = await createApp({ homeDir: home });
      const file = path.join(home, CONFIG);
      const original = await fs.readFile(file, "utf8");

      const res = await app.request("/api/config/patch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: file,
          ops: [{ op: "jsonSet", path: ["mcp", "servers", "newone"], value: { command: "x" } }],
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { changed: boolean; backup: string | null };
      expect(body.changed).toBe(true);
      expect(body.backup).toBeTruthy();

      // 备份列表含原始内容
      const list = await app.request(`/api/config/backups?path=${encodeURIComponent(file)}`);
      const listBody = (await list.json()) as { entries: { file: string }[] };
      expect(listBody.entries.length).toBe(1);
      const backed = await fs.readFile(listBody.entries[0].file, "utf8");
      expect(backed).toBe(original);

      // 恢复 → 回到原始内容
      const restore = await app.request("/api/config/restore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ backup: listBody.entries[0].file }),
      });
      expect(restore.status).toBe(200);
      expect(await fs.readFile(file, "utf8")).toBe(original);
    } finally {
      await cleanupFixture(home);
    }
  });

  it("外部修改后写回 → 409 拒绝", async () => {
    const home = await makeFixtureHome();
    try {
      const { app } = await createApp({ homeDir: home });
      const file = path.join(home, CONFIG);

      // 先读一次,拿到乐观锁 hash
      const read = await app.request(`/api/config/read?path=${encodeURIComponent(file)}`);
      const { hash } = (await read.json()) as { hash: string };

      // 宿主 CLI 在外部改了文件
      await fs.appendFile(file, '\n// host touched this\n');

      const res = await app.request("/api/config/patch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: file,
          expectedHash: hash,
          ops: [{ op: "jsonSet", path: ["mcp", "servers", "x"], value: { command: "y" } }],
        }),
      });
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("外部修改");
      // 拒绝后文件未被覆盖
      const content = await fs.readFile(file, "utf8");
      expect(content).toContain("host touched this");
    } finally {
      await cleanupFixture(home);
    }
  });

  it("备份滚动保留 keep 份", async () => {
    const home = await makeFixtureHome();
    try {
      const { app } = await createApp({ homeDir: home });
      const file = path.join(home, CONFIG);
      for (let i = 0; i < 4; i++) {
        await app.request("/api/config/patch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            path: file,
            keep: 2,
            ops: [{ op: "jsonSet", path: ["gen"], value: i }],
          }),
        });
      }
      const list = await app.request(`/api/config/backups?path=${encodeURIComponent(file)}`);
      const body = (await list.json()) as { entries: unknown[] };
      expect(body.entries.length).toBe(2);
    } finally {
      await cleanupFixture(home);
    }
  });

  it("主目录外的路径被拒绝", async () => {
    const home = await makeFixtureHome();
    try {
      const { app } = await createApp({ homeDir: home });
      const res = await app.request("/api/config/patch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: "C:/Windows/system32/evil.json",
          ops: [{ op: "jsonSet", path: ["x"], value: 1 }],
        }),
      });
      expect(res.status).toBe(400);
    } finally {
      await cleanupFixture(home);
    }
  });
});
