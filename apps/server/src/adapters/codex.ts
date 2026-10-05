import path from "node:path";
import { readFileSync } from "node:fs";
import type { ProviderAdapter, SwitchFilePlan } from "./types.js";
import type { ProviderProfile } from "../registry.js";
import { slugify } from "../registry.js";
import type { PatchOp } from "../engine/ops.js";
import { parseToml } from "../engine/toml.js";

/**
 * Codex:config.toml 单槽自定义供应商。
 * 切换 = 写 [model_providers.<slug>] 的 name/base_url + 顶层 model_provider/model。
 * 绝不触碰 auth 相关文件与键(风险清单 #4);未提及的段内键原样保留。
 */
export function createCodexAdapter(hostRoot: string): ProviderAdapter {
  const providerFile = path.join(hostRoot, "config.toml");
  return {
    id: "codex",
    name: "Codex",
    providerFile,
    effectModel: "restart",
    readActive() {
      let parsed: Record<string, unknown>;
      try {
        parsed = parseToml<Record<string, unknown>>(readFileSync(providerFile, "utf8"));
      } catch {
        return { slug: null, model: null };
      }
      const slug = typeof parsed.model_provider === "string" ? parsed.model_provider : null;
      const model = typeof parsed.model === "string" ? parsed.model : null;
      return { slug, model };
    },
    switchPlan(profile: ProviderProfile): SwitchFilePlan[] {
      const slug = slugify(profile.name);
      const override = profile.perHostOverrides?.codex;
      const baseUrl = override?.baseUrl ?? profile.baseUrl;
      const ops: PatchOp[] = [
        { op: "setScalar", table: ["model_providers", slug], key: "name", value: slug },
        { op: "setScalar", table: ["model_providers", slug], key: "base_url", value: baseUrl },
        { op: "setScalar", table: [], key: "model_provider", value: slug },
      ];
      const activeModel = override?.model ?? profile.models[0];
      if (activeModel) {
        ops.push({ op: "setScalar", table: [], key: "model", value: activeModel });
      }
      return [{ file: providerFile, ops }];
    },
  };
}
