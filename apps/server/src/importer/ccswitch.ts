import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { parse as parseTomlText } from "smol-toml";

// node:sqlite 在 vite 转换层下不可解析,用 createRequire 直连 Node 原生模块
const requireSqlite = createRequire(import.meta.url) as (id: string) => typeof import("node:sqlite");

export interface CcSwitchImportItem {
  name: string;
  baseUrl: string;
  apiKey: string;
  note: string;
}

export interface CcSwitchImportReport {
  total: number;
  imported: number;
  skipped: number;
  items: CcSwitchImportItem[];
  skippedNotes: string[];
}

const DEFAULT_DB = path.join(os.homedir(), ".cc-switch", "cc-switch.db");

function isLocalUrl(url: string): boolean {
  return /\/\/(127\.0\.0\.1|localhost|\[::1\])/.test(url);
}

/**
 * 从 cc-switch 的 SQLite 档案导入供应商(只读 cc-switch,ADR-0002)。
 * - claude 行:settings_config.env 的 ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN
 * - codex 行:auth.OPENAI_API_KEY + config TOML 的 [model_providers.custom] base_url;
 *   base_url 指向 cc-switch 本地代理时,回退 provider_endpoints 表里的真实上游。
 */
export async function importFromCcSwitch(dbPath = DEFAULT_DB): Promise<CcSwitchImportReport> {
  if (!fs.existsSync(dbPath)) throw new Error(`找不到 cc-switch 数据库:${dbPath}`);
  // node:sqlite 只读打开,保证不碰 cc-switch 自身
  const { DatabaseSync } = requireSqlite("node:sqlite");
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const rows = db
      .prepare("SELECT id, app_type, name, settings_config, is_current FROM providers")
      .all() as { id: string; app_type: string; name: string; settings_config: string; is_current: number }[];
    const endpoints = db
      .prepare("SELECT provider_id, url FROM provider_endpoints")
      .all() as { provider_id: string; url: string }[];

    const report: CcSwitchImportReport = { total: rows.length, imported: 0, skipped: 0, items: [], skippedNotes: [] };
    for (const row of rows) {
      let cfg: Record<string, unknown>;
      try {
        cfg = JSON.parse(row.settings_config) as Record<string, unknown>;
      } catch {
        report.skipped++;
        report.skippedNotes.push(`${row.app_type}/${row.name}: settings_config 非 JSON`);
        continue;
      }
      let baseUrl = "";
      let apiKey = "";
      if (row.app_type === "claude") {
        const env = (cfg.env ?? {}) as Record<string, string>;
        baseUrl = env.ANTHROPIC_BASE_URL ?? "";
        apiKey = env.ANTHROPIC_AUTH_TOKEN ?? env.ANTHROPIC_API_KEY ?? "";
      } else if (row.app_type === "codex") {
        const auth = (cfg.auth ?? {}) as Record<string, string>;
        apiKey = auth.OPENAI_API_KEY ?? "";
        try {
          const toml = parseTomlText(String(cfg.config ?? "")) as {
            model_providers?: { custom?: { base_url?: string } };
          };
          baseUrl = toml.model_providers?.custom?.base_url ?? "";
        } catch {
          /* TOML 解析失败则留空 */
        }
        if (baseUrl && isLocalUrl(baseUrl)) {
          const real = endpoints.find((e) => e.provider_id === row.id)?.url;
          if (real) {
            baseUrl = real;
          } else {
            report.skipped++;
            report.skippedNotes.push(`${row.app_type}/${row.name}: base_url 指向本地代理且无真实上游记录`);
            continue;
          }
        }
      }
      if (!baseUrl || !apiKey) {
        report.skipped++;
        report.skippedNotes.push(`${row.app_type}/${row.name}: 缺少 baseUrl 或 apiKey`);
        continue;
      }
      const suffix = rows.filter((r) => r.name === row.name).length > 1 ? ` (${row.app_type})` : "";
      report.items.push({
        name: `${row.name}${suffix}`,
        baseUrl,
        apiKey,
        note: row.is_current ? "cc-switch 当前激活" : "",
      });
      report.imported++;
    }
    return report;
  } finally {
    db.close();
  }
}
