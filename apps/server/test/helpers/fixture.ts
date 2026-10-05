import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

/**
 * 构造 fixture 假环境:临时目录里摆出四家宿主的迷你配置。
 * 这是全项目唯一的测试注入方式(单缝:API 对 fixture)。
 */
export async function makeFixtureHome(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aienv-fixture-"));
  await Promise.all([
    fs.mkdir(path.join(dir, ".zcode", "cli"), { recursive: true }),
    fs.mkdir(path.join(dir, ".codex"), { recursive: true }),
    fs.mkdir(path.join(dir, ".config", "opencode"), { recursive: true }),
    fs.mkdir(path.join(dir, ".dsh", "profiles", "desktop"), { recursive: true }),
    fs.mkdir(path.join(dir, ".agents", "skills"), { recursive: true }),
  ]);
  await fs.writeFile(
    path.join(dir, ".zcode", "cli", "config.json"),
    JSON.stringify({ plugins: {}, mcp: { servers: {} } }, null, 2),
  );
  await fs.writeFile(
    path.join(dir, ".codex", "config.toml"),
    `model = "gpt-x"\nmodel_provider = "custom"\n\n[mcp_servers.demo]\ncommand = "demo-cmd"\n`,
  );
  await fs.writeFile(
    path.join(dir, ".config", "opencode", "opencode.json"),
    JSON.stringify({ $schema: "x", provider: {}, mcp: {}, model: "" }, null, 2),
  );
  await fs.writeFile(
    path.join(dir, ".dsh", "profiles", "desktop", "package.json"),
    JSON.stringify({ name: "dsh-profile-desktop", dsh: { profile: { bundles: [] } } }, null, 2),
  );
  await fs.writeFile(
    path.join(dir, ".dsh", "profiles", "desktop", "cordis.patch.yml"),
    "[]\n",
  );
  return dir;
}

export async function cleanupFixture(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}
