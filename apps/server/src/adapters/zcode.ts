import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import type { ProviderAdapter, SwitchFilePlan } from "./types.js";
import type { ProviderProfile } from "../registry.js";
import { slugify } from "../registry.js";
import type { PatchOp } from "../engine/ops.js";
import { parseJsonc } from "../engine/jsonc.js";

/**
 * ZCode 供应商切换。结构依据本机 spike(docs/spike/zcode-provider-config.md):
 * - provider_config.json:providerRules upsert(providerId=slug)+ providerOrder 追加
 * - config.json:provider.<slug> 注册条目(name/options{apiKey,baseURL}/enabled/models)
 * - setting.json:modelProviderFamilySelectedKeys.zai = slug(激活;读取端兼容 kind: 前缀)
 * 凭据只写上述字段;credentials.json(OAuth/token)一律不碰。
 */
export function createZcodeAdapter(hostRoot: string): ProviderAdapter {
  const rulesFile = path.join(hostRoot, "provider_config.json");
  const registryFile = path.join(hostRoot, "config.json");
  const settingFile = path.join(hostRoot, "setting.json");

  function readActiveSlug(): string | null {
    try {
      const s = parseJsonc<{ modelProviderFamilySelectedKeys?: { zai?: string } }>(
        readFileSync(settingFile, "utf8"),
      );
      const raw = s.modelProviderFamilySelectedKeys?.zai;
      if (!raw) return null;
      // 兼容 "[kind:]providerId" 两种格式
      const parts = raw.split(":");
      return parts[parts.length - 1] || null;
    } catch {
      return null;
    }
  }

  return {
    id: "zcode",
    name: "ZCode",
    providerFile: registryFile,
    effectModel: "restart",
    readActive() {
      let slug: string | null = null;
      try {
        slug = readActiveSlug();
      } catch {
        slug = null;
      }
      let model: string | null = null;
      return { slug, model };
    },
    switchPlan(profile: ProviderProfile): SwitchFilePlan[] {
      const slug = slugify(profile.name);
      const override = profile.perHostOverrides?.zcode;
      const baseUrl = override?.baseUrl ?? profile.baseUrl;
      const activeModel = override?.model ?? profile.models[0];
      const plans: SwitchFilePlan[] = [];

      // 1) provider_config.json:规则 upsert + providerOrder
      if (existsSync(rulesFile)) {
        const pc = parseJsonc<ZcodeProviderConfig>(readFileSync(rulesFile, "utf8"));
        pc.config ??= {};
        pc.config.providerConfigRules ??= { providerRules: [] };
        const rules = pc.config.providerConfigRules.providerRules ?? [];
        const idx = rules.findIndex((r) => r.providerId === slug || r.providerName === profile.name);
        const existing = idx >= 0 ? rules[idx] : undefined;
        const rule: ZcodeRule = {
          providerId: slug,
          providerName: profile.name,
          config: {
            ...existing?.config,
            access: { ...(existing?.config?.access ?? {}), type: "api-key", apiKey: profile.apiKey },
            api: {
              ...(existing?.config?.api ?? {}),
              type: existing?.config?.api?.type ?? "openai",
              baseUrl,
            },
            personalModelIds: profile.models,
          },
        };
        const newRules = [...rules];
        if (idx >= 0) newRules[idx] = rule;
        else newRules.push(rule);
        const order = (pc.config.providerOrder ?? []).filter((x) => x !== slug);
        const pcOps: PatchOp[] = [
          { op: "jsonSet", path: ["config", "providerConfigRules", "providerRules"], value: newRules },
          { op: "jsonSet", path: ["config", "providerOrder"], value: [slug, ...order] },
        ];
        plans.push({ file: rulesFile, ops: pcOps });
      }

      // 2) config.json:provider 注册条目
      const registryOps: PatchOp[] = [];
      let existingEntry: Record<string, unknown> | null = null;
      if (existsSync(registryFile)) {
        try {
          const cfg = parseJsonc<{ provider?: Record<string, Record<string, unknown>> }>(
            readFileSync(registryFile, "utf8"),
          );
          existingEntry = cfg.provider?.[slug] ?? null;
        } catch {
          existingEntry = null;
        }
      }
      const entry = {
        ...(existingEntry ?? {}),
        name: profile.name,
        options: {
          ...((existingEntry?.options as Record<string, unknown>) ?? {}),
          apiKey: profile.apiKey,
          baseURL: baseUrl,
        },
        enabled: true,
        models: Object.fromEntries(profile.models.map((m) => [m, {}])),
      };
      registryOps.push({ op: "jsonSet", path: ["provider", slug], value: entry });
      plans.push({
        file: registryFile,
        ops: registryOps,
        createIfMissing: existsSync(registryFile) ? undefined : "{}\n",
      });

      // 3) setting.json:激活(裸 slug;读取端兼容 kind: 前缀)
      const settingOps: PatchOp[] = [
        { op: "jsonSet", path: ["modelProviderFamilySelectedKeys", "zai"], value: slug },
      ];
      plans.push({
        file: settingFile,
        ops: settingOps,
        createIfMissing: existsSync(settingFile) ? undefined : "{}\n",
      });

      void activeModel;
      return plans;
    },
  };
}

interface ZcodeProviderConfig {
  schemaVersion?: number;
  config?: {
    providerOrder?: string[];
    providerConfigRules?: { providerRules?: ZcodeRule[] };
    modelConfigRules?: unknown;
  };
}

interface ZcodeRule {
  providerId: string;
  providerName: string;
  config: {
    group?: string;
    access?: Record<string, unknown> & { type?: string; apiKey?: string };
    api?: Record<string, unknown> & { type?: string; baseUrl?: string };
    personalModelIds?: string[];
    modelOrder?: string[];
  };
}
