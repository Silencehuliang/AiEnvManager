import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import type { Settings } from "./settings.js";

export interface ProjectInfo {
  /** 项目根绝对路径 */
  root: string;
  /** 命中的标记文件(相对项目根) */
  markers: string[];
}

const MARKERS = [".agents", "AGENTS.md", "cordis.patch.yml", ".zcode"];
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "__pycache__"]);
const MAX_DEPTH = 3;

/** 扫描根目录发现项目(标记:AGENTS.md / .agents / cordis.patch.yml / .zcode) */
export async function discoverProjects(settings: Settings): Promise<ProjectInfo[]> {
  const projects: ProjectInfo[] = [];
  const excludes = new Set(settings.excludes.map((e) => path.resolve(e)));
  for (const root of settings.scanRoots) {
    const absRoot = path.resolve(root);
    if (!fs.existsSync(absRoot)) continue;
    await walk(absRoot, absRoot, 0, excludes, projects);
  }
  return projects;
}

async function walk(
  dir: string,
  root: string,
  depth: number,
  excludes: Set<string>,
  out: ProjectInfo[],
): Promise<void> {
  if (excludes.has(dir)) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  const markers = MARKERS.filter((m) => entries.some((e) => e.name === m));
  if (markers.length > 0 && dir !== path.resolve(root)) {
    out.push({ root: dir, markers });
    return; // 命中项目即停,不再下探
  }
  if (depth >= MAX_DEPTH) return;
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
    await walk(path.join(dir, e.name), root, depth + 1, excludes, out);
  }
  void fsp;
}
