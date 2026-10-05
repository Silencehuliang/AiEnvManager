import { parse } from "smol-toml";
import type { PatchOp, TomlValue } from "./ops.js";

/**
 * TOML 定位文本修补器:逐行扫描,只改目标行/目标段,
 * 其余行(含注释、未知键)逐字节保留。
 */

interface Section {
  /** 表路径的规范化段(去引号) */
  path: string[];
  /** 段头所在行下标;-1 表示顶层 */
  headerLine: number;
  /** 段体起始行(含段头行自身) */
  startLine: number;
  /** 段体结束行(不含下一个段头);顶层段为首个段头之前 */
  endLine: number;
}

/** 解析段头内的键路径,支持引号段:[plugins."dsh@market"] */
export function splitTomlPath(raw: string): string[] {
  const segments: string[] = [];
  let current = "";
  let inQuote: string | null = null;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
      else current += ch;
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === ".") {
      segments.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  segments.push(current.trim());
  return segments.filter((s) => s.length > 0);
}

function scanSections(lines: string[]): Section[] {
  const sections: Section[] = [{ path: [], headerLine: -1, startLine: 0, endLine: lines.length }];
  let currentPath: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*\[([^\]]+)\]/);
    if (m) {
      const prev = sections[sections.length - 1];
      prev.endLine = i;
      currentPath = splitTomlPath(m[1]);
      sections.push({ path: currentPath, headerLine: i, startLine: i, endLine: lines.length });
    }
  }
  return sections;
}

function findSection(sections: Section[], table: string[]): Section | undefined {
  return sections.find((s) => s.path.join("\u0000") === table.join("\u0000"));
}

export function formatTomlValue(value: TomlValue): string {
  if (typeof value === "string") return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map((v) => formatTomlValue(v as TomlValue)).join(", ")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).map(([k, v]) => `${k} = ${formatTomlValue(v as TomlValue)}`);
    return `{ ${entries.join(", ")} }`;
  }
  return "null";
}

function isBareKey(key: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(key);
}

export function tableHeader(table: string[]): string {
  return `[${table.map((s) => (isBareKey(s) ? s : `"${s.replace(/"/g, '\\"')}"`)).join(".")}]`;
}

/** 保留行尾注释 */
function replaceValueLine(line: string, newValue: TomlValue, key: string): string {
  const m = line.match(/^(\s*)(["']?[A-Za-z0-9_.-]+["']?\s*)(=)(.*)$/);
  if (!m) return line;
  const trailing = line.match(/(#\s*.*)$/);
  const tail = trailing ? `  ${trailing[1]}` : "";
  return `${m[1]}${key} = ${formatTomlValue(newValue)}${tail}`;
}

function keyMatches(line: string, key: string): boolean {
  const m = line.match(/^\s*(.+?)\s*=/);
  if (!m) return false;
  const raw = m[1].trim();
  const bare = raw.replace(/^["']|["']$/g, "");
  return bare === key;
}

export function patchToml(content: string, ops: Extract<PatchOp, { op: "setScalar" | "removeKey" | "removeTable" }>[] ): string {
  let lines = content.split(/\r?\n/);
  for (const op of ops) {
    if (op.op === "removeTable") {
      lines = removeTable(lines, op.table);
    } else {
      lines = upsertKey(lines, op);
    }
  }
  return lines.join("\n");
}

function upsertKey(lines: string[], op: Extract<PatchOp, { op: "setScalar" | "removeKey" }>): string[] {
  const sections = scanSections(lines);
  const section = findSection(sections, op.table);
  if (!section) {
    if (op.op === "removeKey") return lines;
    // 追加新段到文件尾
    const out = [...lines];
    while (out.length > 0 && out[out.length - 1].trim() === "") out.pop();
    out.push("", tableHeader(op.table), `${op.key} = ${formatTomlValue((op as { value: TomlValue }).value)}`);
    return out;
  }
  const out = [...lines];
  let bodyEnd = section.endLine;
  let insertAt = -1;
  let found = false;
  let indent = op.table.length > 0 ? "  " : "";
  for (let i = section.startLine + (section.headerLine >= 0 ? 1 : 0); i < section.endLine; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    if (/^\s*\[/.test(line)) break;
    const keyM = line.match(/^(\s*)(.+?)\s*=/);
    if (keyM && indent === "" && op.table.length > 0) indent = keyM[1];
    if (keyM && keyMatches(line, op.key)) {
      found = true;
      if (op.op === "removeKey") {
        out.splice(i, 1);
        bodyEnd -= 1;
      } else {
        out[i] = replaceValueLine(line, (op as { value: TomlValue }).value, op.key);
      }
      break;
    }
    if (!found) insertAt = i + 1;
  }
  if (!found && op.op === "setScalar") {
    const insert = `${indent}${op.key} = ${formatTomlValue((op as { value: TomlValue }).value)}`;
    if (insertAt >= section.startLine && insertAt <= bodyEnd) out.splice(insertAt, 0, insert);
    else out.splice(bodyEnd, 0, insert);
  }
  return out;
}

function removeTable(lines: string[], table: string[]): string[] {
  const sections = scanSections(lines);
  const section = findSection(sections, table);
  if (!section) return lines;
  const out = [...lines];
  out.splice(section.headerLine, section.endLine - section.headerLine);
  // 吸掉段头前紧邻的空行
  let i = section.headerLine - 1;
  while (i >= 0 && out[i].trim() === "") {
    out.splice(i, 1);
    i--;
  }
  return out;
}

/** 只读解析(读取现状用),写路径不走这里 */
export function parseToml<T = Record<string, unknown>>(content: string): T {
  return parse(content) as T;
}
