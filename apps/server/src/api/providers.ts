import type { Hono } from "hono";
import type { HostId } from "@aienv/shared";
import type { AppContext } from "../app.js";
import { guardInsideHome } from "../app.js";
import { redactAll } from "../providerStore.js";
import { slugify } from "../registry.js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import fsp from "node:fs/promises";
import type { ProviderAdapter } from "../adapters/types.js";
import type { ProviderProfile } from "../registry.js";

interface ProviderInput {
  name: string;
  baseUrl: string;
  apiKey: string;
  models?: string[];
  perHostOverrides?: ProviderProfile["perHostOverrides"];
}

export function registerProviderRoutes(
  app: Hono,
  ctx: AppContext,
  adapters: Map<HostId, ProviderAdapter>,
) {
  app.get("/api/providers", async (c) => {
    const profiles = await ctx.store.list();
    const active: Record<string, { slug: string | null; model: string | null }> = {};
    for (const [hostId, adapter] of adapters) {
      active[hostId] = adapter.readActive();
    }
    return c.json({ profiles: redactAll(profiles), active });
  });

  app.post("/api/providers", async (c) => {
    const input = (await c.req.json()) as ProviderInput;
    if (!input.name || !input.baseUrl || !input.apiKey) {
      return c.json({ error: "name / baseUrl / apiKey 必填" }, 400);
    }
    const profile = await ctx.store.upsert(input);
    return c.json({ profile: redactAll([profile])[0] });
  });

  app.put("/api/providers/:id", async (c) => {
    const input = (await c.req.json()) as Partial<ProviderInput>;
    try {
      const profile = await ctx.store.upsert({ ...input, id: c.req.param("id") });
      return c.json({ profile: redactAll([profile])[0] });
    } catch (e) {
      return c.json({ error: (e as Error).message }, 404);
    }
  });

  app.delete("/api/providers/:id", async (c) => {
    const profile = await ctx.store.get(c.req.param("id"));
    if (!profile) return c.json({ error: "档案不存在" }, 404);
    // 保底规则:活跃供应商不可删,保证卸载本工具后宿主照常可用(ADR-0001)
    for (const [hostId, adapter] of adapters) {
      const { slug } = adapter.readActive();
      if (slug && slug === slugify(profile.name)) {
        return c.json({ error: `该档案正在被 ${hostId} 使用,请先切换到其他供应商` }, 409);
      }
    }
    await ctx.store.remove(profile.id);
    return c.json({ ok: true });
  });

  app.get("/api/providers/:id/preview/:hostId", async (c) => {
    const { profile, adapter } = await resolveTarget(c, ctx, adapters);
    if (!profile || !adapter) return c.json({ error: "档案或宿主适配器不存在" }, 404);
    return c.json({
      files: adapter.switchPlan(profile),
      effectModel: adapter.effectModel,
      current: adapter.readActive(),
    });
  });

  app.post("/api/providers/:id/switch/:hostId", async (c) => {
    const { profile, adapter } = await resolveTarget(c, ctx, adapters);
    if (!profile || !adapter) return c.json({ error: "档案或宿主适配器不存在" }, 404);
    const body = (await c.req.json().catch(() => ({}))) as { expectedHash?: string };
    const plans = adapter.switchPlan(profile);
    const applied: { file: string; changed: boolean; backup: string | null }[] = [];
    for (const plan of plans) {
      const file = guardInsideHome(ctx.homeDir, plan.file);
      if (!existsSync(file)) {
        if (plan.createIfMissing === undefined) {
          return c.json({ error: `宿主配置文件不存在:${file}` }, 404);
        }
        // 播种空底(其内容本身来自宿主自己的旧文件或官方骨架,不算外部配置改动)
        await fsp.mkdir(path.dirname(file), { recursive: true });
        await fsp.writeFile(file, plan.createIfMissing, "utf8");
      }
      if (body.expectedHash && file === guardInsideHome(ctx.homeDir, adapter.providerFile)) {
        const current = readFileSync(file, "utf8");
        if (ctx.hashOf(current) !== body.expectedHash) {
          return c.json({ error: "文件自上次读取后被外部修改,已拒绝写入,请刷新后重试" }, 409);
        }
      }
      const result = await ctx.engine.patchFile(file, plan.ops);
      applied.push({ file, changed: result.changed, backup: result.backup });
    }
    return c.json({ ok: true, hostId: c.req.param("hostId"), slug: slugify(profile.name), applied });
  });
}

async function resolveTarget(
  c: { req: { param(k: string): string } },
  ctx: AppContext,
  adapters: Map<HostId, ProviderAdapter>,
): Promise<{ profile: ProviderProfile | null; adapter: ProviderAdapter | null }> {
  const profile = await ctx.store.get(c.req.param("id"));
  const adapter = adapters.get(c.req.param("hostId") as HostId) ?? null;
  return { profile, adapter };
}
