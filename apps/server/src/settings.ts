import fs from "node:fs/promises";
import path from "node:path";

export interface Settings {
  /** 常规写备份保留份数 */
  backupKeep: number;
  /** skills/插件域备份保留份数 */
  backupKeepSkills: number;
  /** 项目扫描根目录 */
  scanRoots: string[];
  /** 排除的项目目录(绝对路径) */
  excludes: string[];
  /** dsh 命令真实执行前的 dry-run 开关(测试/演示用) */
  dshDryRun: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  backupKeep: 10,
  backupKeepSkills: 20,
  scanRoots: [],
  excludes: [],
  dshDryRun: false,
};

export async function loadSettings(dataDir: string): Promise<Settings> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(dataDir, "settings.json"), "utf8")) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...raw };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(dataDir: string, settings: Settings): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(path.join(dataDir, "settings.json"), JSON.stringify(settings, null, 2), "utf8");
}
