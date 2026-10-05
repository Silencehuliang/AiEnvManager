import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { ProviderProfile, RedactedProfile } from "./registry.js";
import { redactProfile } from "./registry.js";

/** 档案库持久层:dataDir/registry.json(共享档案,ADR-0002) */
export class ProviderStore {
  constructor(private file: string) {}

  async list(): Promise<ProviderProfile[]> {
    try {
      const raw = JSON.parse(await fs.readFile(this.file, "utf8")) as { providers?: ProviderProfile[] };
      return raw.providers ?? [];
    } catch {
      return [];
    }
  }

  async get(id: string): Promise<ProviderProfile | null> {
    const all = await this.list();
    return all.find((p) => p.id === id) ?? null;
  }

  async upsert(input: Partial<ProviderProfile> & { name?: string; baseUrl?: string; apiKey?: string }): Promise<ProviderProfile> {
    const all = await this.list();
    const now = Date.now();
    let profile: ProviderProfile;
    if (input.id) {
      const existing = all.find((p) => p.id === input.id);
      if (!existing) throw new Error(`档案不存在:${input.id}`);
      profile = { ...existing, ...input, id: existing.id, createdAt: existing.createdAt } as ProviderProfile;
      const idx = all.findIndex((p) => p.id === input.id);
      all[idx] = profile;
    } else {
      if (!input.name || !input.baseUrl || !input.apiKey) {
        throw new Error("name / baseUrl / apiKey 必填");
      }
      profile = {
        id: crypto.randomUUID(),
        name: input.name,
        baseUrl: input.baseUrl,
        apiKey: input.apiKey,
        models: input.models ?? [],
        perHostOverrides: input.perHostOverrides,
        createdAt: now,
      };
      all.push(profile);
    }
    await this.write(all);
    return profile;
  }

  async remove(id: string): Promise<void> {
    const all = await this.list();
    await this.write(all.filter((p) => p.id !== id));
  }

  async seed(profiles: Omit<ProviderProfile, "id" | "createdAt">[]): Promise<number> {
    const all = await this.list();
    let imported = 0;
    for (const p of profiles) {
      if (all.some((x) => x.name === p.name)) continue;
      all.push({ ...p, id: crypto.randomUUID(), createdAt: Date.now() });
      imported++;
    }
    await this.write(all);
    return imported;
  }

  private async write(all: ProviderProfile[]): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify({ providers: all }, null, 2), "utf8");
  }
}

export function redactAll(profiles: ProviderProfile[]): RedactedProfile[] {
  return profiles.map(redactProfile);
}
