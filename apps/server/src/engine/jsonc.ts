import * as jsoncNs from "jsonc-parser";
import type { PatchOp } from "./ops.js";

// jsonc-parser 是 CJS 包,不同互操作路径下命名导出不可靠,取命名空间并兼容 default
const jsonc = ((jsoncNs as { default?: typeof jsoncNs }).default ?? jsoncNs) as typeof jsoncNs;

type JsoncOp = Extract<PatchOp, { op: "jsonSet" | "jsonRemove" }>;

/**
 * JSONC 定位修补:modify 产生最小文本编辑(树内偏移量),
 * 注释与未知键原地保留。
 */
export function patchJsonc(content: string, ops: JsoncOp[]): string {
  let text = content;
  for (const op of ops) {
    const edits = jsonc.modify(
      text,
      op.path as Parameters<typeof jsonc.modify>[1],
      op.op === "jsonSet" ? op.value : undefined,
      { formattingOptions: { tabSize: 2, insertSpaces: true } },
    );
    if (op.op === "jsonSet" && (!edits || edits.length === 0)) {
      throw new Error(`jsonSet 失败:路径 ${JSON.stringify(op.path)} 无法编辑`);
    }
    if (edits && edits.length > 0) text = jsonc.applyEdits(text, edits);
  }
  return text;
}

/** 解析 JSONC(容忍注释) */
export function parseJsonc<T = unknown>(content: string): T {
  return jsonc.parse(content) as T;
}
