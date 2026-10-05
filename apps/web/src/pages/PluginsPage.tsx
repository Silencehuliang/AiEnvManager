import { useCallback, useEffect, useState } from "react";

const HOST_NAMES: Record<string, string> = { zcode: "ZCode", codex: "Codex", opencode: "OpenCode", dsh: "dsh" };

interface PluginEntry {
  id: string;
  enabled: boolean;
}

interface PluginsResponse {
  hosts: Record<string, { readonly: boolean; effectModel: string; entries: PluginEntry[] }>;
}

interface DshProfileTree {
  name: string;
  bundles: string[];
  entries: { id: string; name?: string; disabled: boolean; managed: boolean }[];
}

interface DshProfilesResponse {
  profiles: DshProfileTree[];
  effectModel: string;
  note: string;
}

async function send<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
    throw new Error(b.error ?? String(res.status));
  }
  return res.json() as Promise<T>;
}

export default function PluginsPage() {
  const [data, setData] = useState<PluginsResponse | null>(null);
  const [dsh, setDsh] = useState<DshProfilesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    fetch("/api/plugins")
      .then((r) => r.json() as Promise<PluginsResponse>)
      .then(setData)
      .catch((e) => setError(String(e)));
    fetch("/api/dsh/profiles")
      .then((r) => r.json() as Promise<DshProfilesResponse>)
      .then(setDsh)
      .catch(() => setDsh(null));
  }, []);
  useEffect(reload, [reload]);

  const toggle = async (url: string, body: unknown) => {
    try {
      await send(url, body);
      reload();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div>
      <h2>插件</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {data &&
        ["zcode", "codex", "opencode"].map((hostId) => (
          <div key={hostId} style={{ marginBottom: 18 }}>
            <h3>
              {HOST_NAMES[hostId]}{" "}
              <span style={{ fontSize: 12, color: "#888" }}>生效:{data.hosts[hostId].effectModel}</span>
            </h3>
            {data.hosts[hostId].entries.length === 0 && <p style={{ color: "#888" }}>无条目</p>}
            {data.hosts[hostId].entries.map((e) => (
              <div key={e.id} style={{ opacity: e.enabled ? 1 : 0.5, marginBottom: 4 }}>
                <span style={{ fontFamily: "monospace", fontSize: 13 }}>{e.id}</span>{" "}
                <span style={{ fontSize: 12 }}>{e.enabled ? "✅" : "⛔"}</span>{" "}
                <button onClick={() => toggle(`/api/plugins/${hostId}/${encodeURIComponent(e.id)}/toggle`, {})}>
                  {e.enabled ? "禁用" : "启用"}
                </button>
              </div>
            ))}
          </div>
        ))}

      {dsh && (
        <div style={{ marginTop: 10 }}>
          <h3>
            dsh 插件组合树{" "}
            <span style={{ fontSize: 12, color: "#888" }}>生效:{dsh.effectModel}(下次请求热重载)</span>
          </h3>
          <p style={{ fontSize: 12, color: "#666" }}>{dsh.note}</p>
          {dsh.profiles.map((p) => (
            <div key={p.name} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <b>profile: {p.name}</b>
              <p style={{ margin: "4px 0", fontSize: 13 }}>
                基础层 bundles:{p.bundles.length === 0 ? "(无)" : p.bundles.join(", ")}
              </p>
              <table cellPadding={4} style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #999", fontSize: 12 }}>
                    <th>patch 条目 id</th>
                    <th>插件包</th>
                    <th>状态</th>
                    <th>来源态</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {p.entries.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ color: "#888", fontSize: 13 }}>
                        无 patch 条目
                      </td>
                    </tr>
                  )}
                  {p.entries.map((e) => (
                    <tr key={e.id} style={{ opacity: e.disabled ? 0.5 : 1 }}>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{e.id}</td>
                      <td style={{ fontSize: 12 }}>{e.name ?? ""}</td>
                      <td>{e.disabled ? "⛔ 禁用" : "✅ 启用"}</td>
                      <td style={{ fontSize: 12 }}>{e.managed ? "托管" : "外来"}</td>
                      <td>
                        <button
                          onClick={() =>
                            toggle(`/api/dsh/profiles/${p.name}/toggle`, { pluginId: e.id, disabled: !e.disabled })
                          }
                        >
                          {e.disabled ? "启用" : "禁用"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
