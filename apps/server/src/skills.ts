import path from "node:path";
import fs from "node:fs";
import type { Layer, Provenance } from "@aienv/shared";
import type { ProjectInfo } from "./scan.js";

export interface SkillItem {
  /** 层内唯一标识:<layer>:<来源路径>:<目录名> */
  id: string;
  /** 目录名 */
  name: string;
  layer: Layer;
  /** SKILL.md 所在目录 */
  dir: string;
  /** 引用该层 skills 的宿主 */
  hosts: string[];
  provenance: Provenance;
  /** SKILL.md frontmatter 里的描述 */
  description?: string;
  /** 项目层时为项目根 */
  project?: string;
  /** 是否处于禁用区(.disabled/ 目录下) */
  disabled: boolean;
}

/** 用户全局层位置 → 引用宿主(.agents 是跨宿主共享约定) */
const USER_SKILL_DIRS: { relative: string[]; hosts: string[] }[] = [
  { relative: [".agents", "skills"], hosts: ["zcode", "codex", "opencode"] },
  { relative: [".config", "opencode", "skills"], hosts: ["opencode"] },
  { relative: [".codex", "skills"], hosts: ["codex"] },
];

/** 内置层(只读):ZCode 插件缓存 */
const BUILTIN_DIRS: { relative: string[]; hosts: string[] }[] = [
  { relative: [".zcode", "cli", "plugins", "cache"], hosts: ["zcode"] },
];

function listSkillDirs(skillsDir: string, disabledRoot: string): { name: string; dir: string; disabled: boolean }[] {
  const out: { name: string; dir: string; disabled: boolean }[] = [];
  if (!fs.existsSync(skillsDir)) return out;
  for (const e of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (e.name === ".disabled") continue;
    const hasSkill = fs.existsSync(path.join(skillsDir, e.name, "SKILL.md"));
    if (hasSkill) out.push({ name: e.name, dir: path.join(skillsDir, e.name), disabled: false });
  }
  // 禁用区:<skillsDir>/.disabled/<name>
  const disabledDir = path.join(disabledRoot, ".disabled");
  if (fs.existsSync(disabledDir)) {
    for (const e of fs.readdirSync(disabledDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const hasSkill = fs.existsSync(path.join(disabledDir, e.name, "SKILL.md"));
      if (hasSkill) out.push({ name: e.name, dir: path.join(disabledDir, e.name), disabled: true });
    }
  }
  return out;
}

function parseFrontmatter(dir: string): { name?: string; description?: string } {
  const file = path.join(dir, "SKILL.md");
  try {
    const head = fs.readFileSync(file, "utf8").split("\n").slice(0, 40).join("\n");
    const m = head.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return {};
    const fields: { name?: string; description?: string } = {};
    for (const line of m[1].split("\n")) {
      const kv = line.match(/^(name|description):\s*(.*)$/);
      if (kv) fields[kv[1] as "name" | "description"] = kv[2].trim().replace(/^["']|["']$/g, "");
    }
    return fields;
  } catch {
    return {};
  }
}

function collect(
  items: SkillItem[],
  layer: Layer,
  skillsDir: string,
  hosts: string[],
  disabledRoot = skillsDir,
  project?: string,
): void {
  for (const entry of listSkillDirs(skillsDir, disabledRoot)) {
    const meta = parseFrontmatter(entry.dir);
    items.push({
      id: `${layer}:${entry.dir}`,
      name: entry.name,
      layer,
      dir: entry.dir,
      hosts,
      provenance: "unmanaged",
      description: meta.description,
      project,
      disabled: entry.disabled,
    });
  }
}

/** 内置层:在插件缓存里搜 SKILL.md(限深,只读) */
function collectBuiltin(items: SkillItem[], cacheDir: string, hosts: string[]): void {
  if (!fs.existsSync(cacheDir)) return;
  const visit = (dir: string, depth: number): void => {
    if (depth > 6 || items.length > 800) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.isFile() && e.name === "SKILL.md")) {
      const name = path.basename(dir);
      items.push({
        id: `builtin:${dir}`,
        name,
        layer: "builtin",
        dir,
        hosts,
        provenance: "unmanaged",
        description: parseFrontmatter(dir).description,
        disabled: false,
      });
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith(".") || e.name === "node_modules") continue;
      visit(path.join(dir, e.name), depth + 1);
    }
  };
  visit(cacheDir, 0);
}

export function listSkills(
  homeDir: string,
  hostRoots: Record<string, string>,
  projects: ProjectInfo[],
): SkillItem[] {
  const items: SkillItem[] = [];
  // 用户全局层
  for (const d of USER_SKILL_DIRS) {
    collect(items, "user", path.join(homeDir, ...d.relative), d.hosts);
  }
  // OpenCode 宿主自己的 skills 目录(config 里 skills.paths 指向它)
  collect(items, "user", path.join(hostRoots.opencode ?? "", "skills"), ["opencode"]);
  // 内置层(只读)
  for (const d of BUILTIN_DIRS) {
    collectBuiltin(items, path.join(homeDir, ...d.relative), d.hosts);
  }
  // 项目层:项目内 .agents/skills
  for (const p of projects) {
    collect(items, "project", path.join(p.root, ".agents", "skills"), ["zcode", "codex", "opencode"], path.join(p.root, ".agents", "skills"), p.root);
  }
  return items;
}
