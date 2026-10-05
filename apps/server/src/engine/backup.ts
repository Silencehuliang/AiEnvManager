import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export interface BackupEntry {
  file: string;
  /** 备份创建时间(ms) */
  ts: number;
  size: number;
}

export interface BackupMeta {
  original: string;
  createdAt: number;
}

/**
 * 备份库:dataDir/backups/<hash12>/ 下,
 * meta.json 记录原始路径,备份文件名为 <ts>-<basename>。
 */
export class BackupStore {
  constructor(private rootDir: string) {}

  private hashFor(file: string): string {
    return crypto.createHash("sha1").update(path.resolve(file)).digest("hex").slice(0, 12);
  }

  private dirFor(file: string): string {
    return path.join(this.rootDir, this.hashFor(file));
  }

  async save(file: string, content: string, keep: number): Promise<BackupEntry> {
    const dir = this.dirFor(file);
    await fs.mkdir(dir, { recursive: true });
    const metaPath = path.join(dir, "meta.json");
    let meta: BackupMeta;
    try {
      meta = JSON.parse(await fs.readFile(metaPath, "utf8")) as BackupMeta;
    } catch {
      meta = { original: path.resolve(file), createdAt: Date.now() };
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
    }
    const ts = Date.now();
    const entryFile = path.join(dir, `${ts}-${path.basename(file)}`);
    await fs.writeFile(entryFile, content, "utf8");
    const entries = await this.list(file);
    // 按时间降序,保留 keep 份数据文件(meta.json 除外)
    const dataFiles = entries.sort((a, b) => b.ts - a.ts);
    for (const old of dataFiles.slice(keep)) {
      await fs.rm(old.file, { force: true });
    }
    return { file: entryFile, ts, size: Buffer.byteLength(content) };
  }

  async list(file: string): Promise<BackupEntry[]> {
    const dir = this.dirFor(file);
    let names: string[];
    try {
      names = await fs.readdir(dir);
    } catch {
      return [];
    }
    const entries: BackupEntry[] = [];
    for (const name of names) {
      if (name === "meta.json") continue;
      const full = path.join(dir, name);
      const st = await fs.stat(full);
      const ts = Number(name.split("-")[0]) || st.mtimeMs;
      entries.push({ file: full, ts, size: st.size });
    }
    return entries;
  }

  async readOriginalPath(file: string): Promise<string | null> {
    try {
      const meta = JSON.parse(await fs.readFile(path.join(this.dirFor(file), "meta.json"), "utf8")) as BackupMeta;
      return meta.original;
    } catch {
      return null;
    }
  }

  /** 恢复指定备份内容(调用方负责先对当前状态再做一次备份) */
  async read(entryFile: string): Promise<string> {
    return fs.readFile(entryFile, "utf8");
  }
}
