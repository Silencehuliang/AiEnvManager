import { describe, expect, it } from "vitest";
import { patchToml, parseToml, splitTomlPath } from "../src/engine/toml.js";
import { patchJsonc, parseJsonc } from "../src/engine/jsonc.js";
import { patchYaml, listYamlEntries } from "../src/engine/yaml.js";

describe("TOML 定位修补", () => {
  const fixture = `# 顶部注释
model = "gpt-x"
model_provider = "custom"
custom_unknown = "keep-me"   # 未知键,带行尾注释

[mcp_servers.demo]
command = "demo-cmd"
# demo 段内注释
env = { A = "1" }

[plugins."dsh@market"]
enabled = true
`;

  it("替换顶层标量:其余行逐字节保留,行尾注释保留", () => {
    const out = patchToml(fixture, [{ op: "setScalar", table: [], key: "model", value: "gpt-next" }]);
    expect(out).toContain('model = "gpt-next"');
    // 未触及行逐字节保留
    expect(out).toContain('# 顶部注释\n');
    expect(out).toContain('custom_unknown = "keep-me"   # 未知键,带行尾注释');
    expect(out).toContain('# demo 段内注释');
    expect(out).toContain('[mcp_servers.demo]');
    // 行尾注释被保留
    const modelLine = out.split("\n").find((l) => l.startsWith("model = "));
    expect(modelLine).toBe('model = "gpt-next"');
  });

  it("新段追加:创建 [model_providers.custom] 并写入键", () => {
    const out = patchToml(fixture, [
      { op: "setScalar", table: ["model_providers", "custom"], key: "base_url", value: "http://127.0.0.1:9000" },
    ]);
    expect(out).toContain('[model_providers.custom]');
    expect(out).toContain('base_url = "http://127.0.0.1:9000"');
    // 原有内容不受影响
    expect(parseToml<{ plugins: { [k: string]: { enabled: boolean } } }>(out).plugins["dsh@market"].enabled).toBe(true);
  });

  it("引号段内键替换与读取", () => {
    const out = patchToml(fixture, [
      { op: "setScalar", table: ["plugins", "dsh@market"], key: "enabled", value: false },
    ]);
    const parsed = parseToml<{ plugins: { [k: string]: { enabled: boolean } } }>(out);
    expect(parsed.plugins["dsh@market"].enabled).toBe(false);
    expect(out).toContain('[plugins."dsh@market"]');
  });

  it("removeTable 删除整段,其余内容保留", () => {
    const out = patchToml(fixture, [{ op: "removeTable", table: ["mcp_servers", "demo"] }]);
    expect(out).not.toContain("[mcp_servers.demo]");
    expect(out).not.toContain('command = "demo-cmd"');
    expect(out).toContain('[plugins."dsh@market"]');
    expect(out).toContain("# 顶部注释");
  });

  it("splitTomlPath 处理引号段", () => {
    expect(splitTomlPath('plugins."dsh@market"')).toEqual(["plugins", "dsh@market"]);
    expect(splitTomlPath("model_providers.custom")).toEqual(["model_providers", "custom"]);
  });
});

describe("YAML 定位修补(cordis.patch.yml)", () => {
  const fixture = `# 组合 patch
- id: base
  disabled: false
  # base 条目注释
  config:
    port: 3000
- id: extra
  enabled: true
  setup: !!js/function "function(){return 1}"
`;

  it("upsertById 修改字段:注释与 !!js 标签保留", () => {
    const out = patchYaml(fixture, [{ op: "yamlUpsertById", id: "base", fields: { disabled: true } }]);
    expect(out).toContain("# 组合 patch");
    expect(out).toContain("# base 条目注释");
    expect(out).toContain("!!js/function");
    expect(out).toContain("config:");
    expect(out).toContain("port: 3000");
    const entries = listYamlEntries(out);
    const base = entries.find((e) => e.id === "base");
    expect((base?.raw as { disabled: boolean }).disabled).toBe(true);
    const extra = entries.find((e) => e.id === "extra");
    expect((extra?.raw as { enabled: boolean }).enabled).toBe(true);
  });

  it("upsertById 追加新条目", () => {
    const out = patchYaml(fixture, [
      { op: "yamlUpsertById", id: "dev-entry", fields: { disabled: true, note: "本地开发" } },
    ]);
    const entries = listYamlEntries(out);
    expect(entries.find((e) => e.id === "dev-entry")).toBeTruthy();
    expect(entries.length).toBe(3);
  });

  it("removeById 删除条目", () => {
    const out = patchYaml(fixture, [{ op: "yamlRemoveById", id: "extra" }]);
    const entries = listYamlEntries(out);
    expect(entries.length).toBe(1);
    expect(entries[0].id).toBe("base");
  });
});

describe("JSONC 定位修补", () => {
  const fixture = `{
  // 插件与 MCP 配置
  "plugins": {},
  "mcp": {
    "servers": {
      "context7": { "command": "npx", "args": ["x"] },
      "unknown_key": "keep-me"
    }
  }
}`;

  it("jsonSet 新增子树:注释与未知键保留", () => {
    const out = patchJsonc(fixture, [
      { op: "jsonSet", path: ["mcp", "servers", "workstation"], value: { command: "node", enabled: true } },
    ]);
    expect(out).toContain("// 插件与 MCP 配置");
    expect(out).toContain('"unknown_key": "keep-me"');
    const parsed = parseJsonc<{ mcp: { servers: Record<string, unknown> } }>(out);
    expect(parsed.mcp.servers.workstation).toEqual({ command: "node", enabled: true });
    expect(parsed.mcp.servers.context7).toEqual({ command: "npx", args: ["x"] });
  });

  it("jsonRemove 删除键", () => {
    const out = patchJsonc(fixture, [{ op: "jsonRemove", path: ["mcp", "servers", "context7"] }]);
    const parsed = parseJsonc<{ mcp: { servers: Record<string, unknown> } }>(out);
    expect(parsed.mcp.servers.context7).toBeUndefined();
    expect(parsed.mcp.servers.unknown_key).toBe("keep-me");
  });
});
