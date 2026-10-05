/**
 * 写盘层的补丁操作。定位修补、全量重序列化禁止(ADR-0001)。
 * 每种格式只接受自己的一类操作,错配由引擎拒绝。
 */

/** TOML 值:标量或一维数组/平面内联表 */
export type TomlValue = string | number | boolean | TomlValue[] | { [k: string]: TomlValue };

export type PatchOp =
  // ---- TOML(apps: Codex)----
  | { op: "setScalar"; table: string[]; key: string; value: TomlValue }
  | { op: "removeKey"; table: string[]; key: string }
  | { op: "removeTable"; table: string[] }
  // ---- JSONC(apps: ZCode/OpenCode/通用 JSON)----
  | { op: "jsonSet"; path: (string | number)[]; value: unknown }
  | { op: "jsonRemove"; path: (string | number)[] }
  // ---- YAML(apps: dsh settings/patch)----
  | { op: "yamlUpsertById"; id: string; fields: Record<string, unknown> }
  | { op: "yamlRemoveById"; id: string }
  /** 映射路径写入(自动创建中间映射),用于 settings 类 YAML */
  | { op: "yamlSet"; path: string[]; value: unknown }
  | { op: "yamlRemove"; path: string[] };

export type Format = "jsonc" | "toml" | "yaml" | "text";

export function detectFormat(file: string): Format {
  const lower = file.toLowerCase();
  if (lower.endsWith(".toml")) return "toml";
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "yaml";
  if (lower.endsWith(".json") || lower.endsWith(".jsonc")) return "jsonc";
  return "text";
}

const FORMAT_OPS: Record<Format, string[]> = {
  jsonc: ["jsonSet", "jsonRemove"],
  toml: ["setScalar", "removeKey", "removeTable"],
  yaml: ["yamlUpsertById", "yamlRemoveById", "yamlSet", "yamlRemove"],
  text: [],
};

export function assertOpsMatchFormat(format: Format, ops: PatchOp[]): void {
  const allowed = FORMAT_OPS[format];
  for (const op of ops) {
    if (!allowed.includes(op.op)) {
      throw new Error(`操作 ${op.op} 不适用于格式 ${format}(文件只接受:${allowed.join(", ")})`);
    }
  }
}
