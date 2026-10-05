import type { HostsResponse } from "@aienv/shared";

export interface RedactedProfile {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
}

export interface ProvidersResponse {
  profiles: RedactedProfile[];
  active: Record<string, { slug: string | null; model: string | null }>;
}

export interface SwitchPreview {
  file: string;
  ops: { op: string; [k: string]: unknown }[];
  effectModel: string;
  current: { slug: string | null; model: string | null };
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
    throw new Error(body.error ?? `${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  hosts: () => fetchJson<HostsResponse>("/api/hosts"),
  providers: () => fetchJson<ProvidersResponse>("/api/providers"),
  createProvider: (input: { name: string; baseUrl: string; apiKey: string; models: string[] }) =>
    fetchJson<{ profile: RedactedProfile }>("/api/providers", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deleteProvider: (id: string) => fetchJson<{ ok: boolean }>(`/api/providers/${id}`, { method: "DELETE" }),
  previewSwitch: (id: string, hostId: string) =>
    fetchJson<SwitchPreview>(`/api/providers/${id}/preview/${hostId}`),
  switchProvider: (id: string, hostId: string) =>
    fetchJson<{ changed: boolean; backup: string | null }>(`/api/providers/${id}/switch/${hostId}`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
};
