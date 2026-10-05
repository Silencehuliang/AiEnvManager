import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { parseDocument } from "yaml";
import type { ProviderAdapter, SwitchFilePlan } from "./types.js";
import type { ProviderProfile } from "../registry.js";
import { slugify } from "../registry.js";
import type { PatchOp } from "../engine/ops.js";

/**
 * dsh(DeepSeek Harness)供应商切换。
 *
 * 结构来源(本机核查,见 issue #6 评论):
 * - settings.yaml:`llm-<name>: { baseURL, models }` + `agent-default-model: { provider, model }`
 *   (键名核自本机 `settings.yaml.imported`;现役 settings.yaml 由 dsh-settings-file 维护)
 * - .credentials.yaml:`version: 1` + `refs` + `records["<scope>/<id>"] =
 *   { kind: api-key, key, env }`(核自 @deepseek-ai/dsh-credentials-local 源码)
 * - 推断项:settings 条目与 credential record 的绑定约定;写错可经备份回滚。
 * 生效模型:settings/patch 下次请求即重读(HMR)。
 */
export function createDshAdapter(hostRoot: string): ProviderAdapter {
  const settingsFile = path.join(hostRoot, "settings.yaml");
  const importedFile = path.join(hostRoot, "settings.yaml.imported");
  const credentialsFile = path.join(hostRoot, ".credentials.yaml");

  function readSettingsText(): string | null {
    for (const f of [settingsFile, importedFile]) {
      if (existsSync(f)) return readFileSync(f, "utf8");
    }
    return null;
  }

  function readActiveFromSettings(): { slug: string | null; model: string | null } {
    const text = readSettingsText();
    if (!text) return { slug: null, model: null };
    try {
      const doc = parseDocument(text);
      const adm = doc.toJS() as { "agent-default-model"?: { provider?: string; model?: string } };
      const adm2 = adm?.["agent-default-model"];
      return {
        slug: typeof adm2?.provider === "string" ? adm2.provider : null,
        model: typeof adm2?.model === "string" ? adm2.model : null,
      };
    } catch {
      return { slug: null, model: null };
    }
  }

  return {
    id: "dsh",
    name: "dsh",
    providerFile: settingsFile,
    effectModel: "next-request",
    readActive: readActiveFromSettings,
    switchPlan(profile: ProviderProfile): SwitchFilePlan[] {
      const slug = slugify(profile.name);
      const override = profile.perHostOverrides?.dsh;
      const baseUrl = override?.baseUrl ?? profile.baseUrl;
      const envName = `DSH_LLM_${slug.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}_API_KEY`;
      const settingsOps: PatchOp[] = [
        { op: "yamlSet", path: [`llm-${slug}`, "baseURL"], value: baseUrl },
        { op: "yamlSet", path: [`llm-${slug}`, "models"], value: profile.models },
        { op: "yamlSet", path: ["agent-default-model", "provider"], value: slug },
      ];
      const activeModel = override?.model ?? profile.models[0];
      if (activeModel) {
        settingsOps.push({ op: "yamlSet", path: ["agent-default-model", "model"], value: activeModel });
      }
      const credentialOps: PatchOp[] = [
        {
          op: "yamlSet",
          path: ["records", `dsh-llm/${slug}`],
          value: { kind: "api-key", key: profile.apiKey, env: envName },
        },
      ];
      return [
        {
          file: settingsFile,
          ops: settingsOps,
          // settings.yaml 不存在时:有 .imported 按其播种,否则最小空表
          createIfMissing: existsSync(settingsFile)
            ? undefined
            : existsSync(importedFile)
              ? readFileSync(importedFile, "utf8")
              : "{}\n",
        },
        {
          file: credentialsFile,
          ops: credentialOps,
          createIfMissing: existsSync(credentialsFile)
            ? undefined
            : "version: 1\nrefs: {}\nrecords: {}\n",
        },
      ];
    },
  };
}
