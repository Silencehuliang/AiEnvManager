import type { HostId } from "@aienv/shared";

/** 供应商档案(共享档案库,ADR-0002):全宿主只录入一次 */
export interface ProviderProfile {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  /** 宿主侧差异覆盖(如各家的模型名映射) */
  perHostOverrides?: Partial<Record<HostId, { model?: string; baseUrl?: string }>>;
  createdAt: number;
}

/** 界面侧的档案:apiKey 永远打码(ADR:write-only 凭证) */
export interface RedactedProfile extends Omit<ProviderProfile, "apiKey"> {
  apiKey: string;
}

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "provider";
}

export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return `${key.slice(0, 2)}****`;
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

export function redactProfile(profile: ProviderProfile): RedactedProfile {
  return { ...profile, apiKey: maskKey(profile.apiKey) };
}
