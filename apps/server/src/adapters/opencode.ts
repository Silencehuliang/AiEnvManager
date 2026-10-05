import path from "node:path";
import { readFileSync } from "node:fs";
import type { ProviderAdapter, SwitchFilePlan } from "./types.js";
import type { ProviderProfile } from "../registry.js";
import { slugify } from "../registry.js";
import type { PatchOp } from "../engine/ops.js";
import { parseJsonc } from "../engine/jsonc.js";

/**
 * OpenCode:opencode.json 的 provider.<slug> 为多槽供应商,
 * model 键 = "<provider-slug>/<model-id>" 决定当前激活项。
 * 切换 = 登记 provider 条目 + 设置 model(最小侵入,只动连接字段与 model)。
 */
export function createOpencodeAdapter(hostRoot: string): ProviderAdapter {
  const providerFile = path.join(hostRoot, "opencode.json");
  return {
    id: "opencode",
    name: "OpenCode",
    providerFile,
    effectModel: "restart",
    readActive() {
      let content: Record<string, unknown>;
      try {
        content = parseJsonc<Record<string, unknown>>(readFileSync(providerFile, "utf8"));
      } catch {
        return { slug: null, model: null };
      }
      const model = typeof content.model === "string" ? content.model : null;
      const slug = model ? (model.split("/")[0] ?? null) : null;
      return { slug, model };
    },
    switchPlan(profile: ProviderProfile): SwitchFilePlan[] {
      const slug = slugify(profile.name);
      const override = profile.perHostOverrides?.opencode;
      const baseUrl = override?.baseUrl ?? profile.baseUrl;
      const ops: PatchOp[] = [
        { op: "jsonSet", path: ["provider", slug, "options", "baseURL"], value: baseUrl },
        { op: "jsonSet", path: ["provider", slug, "options", "apiKey"], value: profile.apiKey },
      ];
      for (const model of profile.models) {
        ops.push({ op: "jsonSet", path: ["provider", slug, "models", model], value: {} });
      }
      const activeModel = override?.model ?? profile.models[0];
      if (activeModel) {
        ops.push({ op: "jsonSet", path: ["model"], value: `${slug}/${activeModel}` });
      }
      return [{ file: providerFile, ops }];
    },
  };
}
