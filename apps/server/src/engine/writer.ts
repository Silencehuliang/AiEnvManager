import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { BackupStore } from "./backup.js";
import { assertOpsMatchFormat, detectFormat, type Format, type PatchOp } from "./ops.js";
import { patchJsonc } from "./jsonc.js";
import { patchToml } from "./toml.js";
import { patchYaml } from "./yaml.js";

export class ConflictError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

function contentHash(content: string): string {
  return crypto.createHash("sha1").update(content).digest("hex");
}

function applyOps(format: Format, content: string, ops: PatchOp[]): string {
  assertOpsMatchFormat(format, ops);
  switch (format) {
    case "jsonc":
      return patchJsonc(content, ops as Parameters<typeof patchJsonc>[1]);
    case "toml":
      return patchToml(content, ops as Parameters<typeof patchToml>[1]);
    case "yaml":
      return patchYaml(content, ops as Parameters<typeof patchYaml>[1]);
    default:
      throw new Error(`格式 ${format} 不支持补丁操作`);
  }
}

export interface PatchResult {
  /** 写回后的新内容 */
  content: string;
  /** 本次写前生成的备份文件;无变化时为 null */
  backup: string | null;
  changed: boolean;
}

/**
 * 事务式写盘(ADR-0001):读 → 补丁 → 乐观并发校验 → 备份 → 原子写回。
 */
export class WriteEngine {
  readonly backups: BackupStore;

  constructor(
    private dataDir: string,
    private defaultKeep: number,
  ) {
    this.backups = new BackupStore(path.join(dataDir, "backups"));
  }

  async patchFile(file: string, ops: PatchOp[], keep = this.defaultKeep): Promise<PatchResult> {
    const before = await fs.stat(file);
    const original = await fs.readFile(file, "utf8");
    const beforeHash = contentHash(original);

    const format = detectFormat(file);
    const next = applyOps(format, original, ops);
    const changed = next !== original;
    if (!changed) return { content: next, backup: null, changed };

    // 乐观并发:读之后文件被外部改动 → 拒绝覆盖
    const after = await fs.stat(file);
    if (after.mtimeMs !== before.mtimeMs || after.size !== before.size) {
      const current = await fs.readFile(file, "utf8");
      if (contentHash(current) !== beforeHash) {
        throw new ConflictError(
          `文件在读入后被外部修改(可能是宿主 CLI 正在运行),已拒绝写入,请刷新后重试:${file}`,
        );
      }
    }

    const backup = await this.backups.save(file, original, keep);
    // 原子写:同目录临时文件 + rename
    const tmp = `${file}.aienv-tmp-${Date.now()}`;
    await fs.writeFile(tmp, next, "utf8");
    await fs.rename(tmp, file);
    return { content: next, backup: backup.file, changed };
  }

  /** 写前快照而不修改文件(供安装/搬运等非补丁类写操作复用) */
  async snapshot(file: string, keep = this.defaultKeep): Promise<string | null> {
    try {
      const content = await fs.readFile(file, "utf8");
      const backup = await this.backups.save(file, content, keep);
      return backup.file;
    } catch {
      return null;
    }
  }
}
