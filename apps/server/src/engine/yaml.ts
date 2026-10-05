import { parseDocument, type Document, type YAMLSeq, type ScalarTag } from "yaml";
import type { PatchOp } from "./ops.js";

/**
 * YAML 定位修补(面向 dsh cordis.patch.yml:顶层数组、按 id upsert)。
 * 使用 yaml 库的 Document API:注释与自定义标签(!!js)在往返中保留。
 * !!js/* 是 js-yaml 系的自定义标签,这里以「原样保留」的方式注册:
 * resolve 原样返回字符串值,序列化时还原标签与值。
 */
const JS_TAGS = [
  "!!js",
  "!!js/function",
  "!!js/function-wrap",
  "!!js/regexp",
  "!!js/undefined",
  "!!js/date",
  "!!js/string",
];

const preserveTag = (tag: string): ScalarTag =>
  ({
    tag,
    resolve: (value: string) => value,
    stringify: (item: { value: unknown }) =>
      typeof item.value === "string" ? item.value : String(item.value ?? ""),
  }) as unknown as ScalarTag;

const CUSTOM_TAGS: ScalarTag[] = JS_TAGS.map(preserveTag);

export function loadYamlDoc(content: string): Document {
  return parseDocument(content, { customTags: CUSTOM_TAGS, version: "1.2" });
}

function topSeq(doc: Document): YAMLSeq | null {
  const contents = doc.contents as unknown;
  if (contents && typeof contents === "object" && "items" in (contents as YAMLSeq)) {
    return contents as YAMLSeq;
  }
  return null;
}

function entryId(item: unknown): string | null {
  if (!item || typeof item !== "object" || !("get" in (item as object))) return null;
  const map = item as { get(key: string): unknown };
  const v = map.get("id");
  return typeof v === "string" ? v : null;
}

function setFields(map: { set(key: string, value: unknown): void }, fields: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(fields)) map.set(k, v);
}

export function patchYaml(
  content: string,
  ops: Extract<PatchOp, { op: "yamlUpsertById" | "yamlRemoveById" | "yamlSet" | "yamlRemove" }>[],
): string {
  const doc = loadYamlDoc(content);
  if (!doc.contents) doc.contents = doc.createNode({});

  for (const op of ops) {
    if (op.op === "yamlSet") {
      doc.setIn(op.path, doc.createNode(op.value));
      continue;
    }
    if (op.op === "yamlRemove") {
      doc.deleteIn(op.path);
      continue;
    }
    let seq = topSeq(doc);
    if (op.op === "yamlUpsertById") {
      if (!seq) {
        doc.contents = doc.createNode([]);
        seq = topSeq(doc);
      }
      if (!seq) throw new Error("yamlUpsertById 只支持顶层数组的 patch 文件");
      const existing = seq.items.find((item) => entryId(item) === op.id);
      if (existing && typeof existing === "object" && "set" in (existing as object)) {
        setFields(existing as { set(key: string, value: unknown): void }, op.fields);
      } else {
        const node = doc.createNode({ id: op.id, ...op.fields });
        seq.items.push(node);
      }
    } else if (op.op === "yamlRemoveById") {
      if (!seq) continue;
      seq.items = seq.items.filter((item) => entryId(item) !== op.id);
    }
  }
  return doc.toString();
}

/** 读取顶层数组的 id 清单与条目(只读) */
export function listYamlEntries(content: string): { id: string | null; raw: unknown }[] {
  const doc = loadYamlDoc(content);
  const seq = topSeq(doc);
  if (!seq) return [];
  return seq.items.map((item) => {
    const toJS = (item as { toJSON?: () => unknown })?.toJSON?.() ?? item;
    const id = entryId(item);
    return { id, raw: toJS };
  });
}
