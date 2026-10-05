import { useCallback, useEffect, useState } from "react";

const HOST_NAMES: Record<string, string> = { zcode: "ZCode", codex: "Codex", opencode: "OpenCode", dsh: "dsh" };

interface McpEntry {
  name: string;
  command?: string;
  enabled: boolean;
}

interface McpResponse {
  hosts: Record<string, { readonly: boolean; effectModel: string; file: string | null; entries: McpEntry[] }>;
}

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const b = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
    throw new Error(b.error ?? String(res.status));
  }
  return res.json() as Promise<T>;
}

export default function McpPage() {
  const [data, setData] = useState<McpResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ hostId: "zcode", name: "", command: "" });

  const reload = useCallback(() => {
    fetch("/api/mcp")
      .then((r) => r.json() as Promise<McpResponse>)
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(reload, [reload]);

  return (
    <div>
      <h2>MCP 服务器(跨宿主)</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {data &&
        Object.entries(data.hosts).map(([hostId, h]) => (
          <div key={hostId} style={{ marginBottom: 20 }}>
            <h3>
              {HOST_NAMES[hostId]}{" "}
              <span style={{ fontSize: 12, color: "#888" }}>
                {h.readonly ? "(只读:走插件生态)" : `生效:${h.effectModel}`}
              </span>
            </h3>
            <table cellPadding={6} style={{ borderCollapse: "collapse", minWidth: 480 }}>
              <tbody>
                {h.entries.length === 0 && (
                  <tr>
                    <td style={{ color: "#888" }}>无条目</td>
                  </tr>
                )}
                {h.entries.map((e) => (
                  <tr key={e.name} style={{ borderBottom: "1px solid #ddd", opacity: e.enabled ? 1 : 0.5 }}>
                    <td>{e.name}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{e.command ?? ""}</td>
                    <td>{e.enabled ? "✅ 启用" : "⛔ 禁用"}</td>
                    {!h.readonly && (
                      <>
                        <td>
                          <button
                            onClick={async () => {
                              try {
                                await send(`/api/mcp/${hostId}/${e.name}/toggle`, "POST");
                                reload();
                              } catch (err) {
                                setError(String(err));
                              }
                            }}
                          >
                            {e.enabled ? "禁用" : "启用"}
                          </button>
                        </td>
                        <td>
                          <button
                            onClick={async () => {
                              try {
                                await send(`/api/mcp/${hostId}/${e.name}`, "DELETE");
                                reload();
                              } catch (err) {
                                setError(String(err));
                              }
                            }}
                          >
                            删除
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      <h3>新增 MCP server</h3>
      <div style={{ display: "grid", gap: 6, maxWidth: 480 }}>
        <select value={form.hostId} onChange={(e) => setForm({ ...form, hostId: e.target.value })}>
          {Object.entries(HOST_NAMES).map(([id, n]) => (
            <option key={id} value={id}>
              {n}
            </option>
          ))}
        </select>
        <input placeholder="名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="command" value={form.command} onChange={(e) => setForm({ ...form, command: e.target.value })} />
        <button
          disabled={!form.name || !form.command}
          onClick={async () => {
            try {
              await send(`/api/mcp/${form.hostId}`, "POST", { name: form.name, command: form.command });
              setForm({ hostId: "zcode", name: "", command: "" });
              reload();
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          添加
        </button>
      </div>
    </div>
  );
}
