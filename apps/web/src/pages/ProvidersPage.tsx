import { useCallback, useEffect, useState } from "react";
import { api, type ProvidersResponse, type SwitchPreview } from "../api.js";

const HOST_NAMES: Record<string, string> = {
  zcode: "ZCode",
  codex: "Codex",
  opencode: "OpenCode",
  dsh: "dsh",
};

export default function ProvidersPage() {
  const [data, setData] = useState<ProvidersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", baseUrl: "", apiKey: "", models: "" });
  const [preview, setPreview] = useState<{ id: string; hostId: string; data: SwitchPreview } | null>(null);

  const reload = useCallback(() => {
    api.providers().then(setData).catch((e) => setError(String(e)));
  }, []);
  useEffect(reload, [reload]);

  const submit = async () => {
    try {
      await api.createProvider({
        name: form.name,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        models: form.models.split(/[,，\s]+/).filter(Boolean),
      });
      setForm({ name: "", baseUrl: "", apiKey: "", models: "" });
      reload();
    } catch (e) {
      setError(String(e));
    }
  };

  const doSwitch = async () => {
    if (!preview) return;
    try {
      await api.switchProvider(preview.id, preview.hostId);
      setPreview(null);
      reload();
    } catch (e) {
      setError(String(e));
      setPreview(null);
    }
  };

  return (
    <div>
      <h2>供应商档案库</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {data && (
        <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #333" }}>
              <th>名称</th>
              <th>Base URL</th>
              <th>API Key(打码)</th>
              <th>模型</th>
              <th>切换到</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.profiles.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid #ddd" }}>
                <td>{p.name}</td>
                <td style={{ fontFamily: "monospace", fontSize: 12 }}>{p.baseUrl}</td>
                <td style={{ fontFamily: "monospace", fontSize: 12 }}>{p.apiKey}</td>
                <td style={{ fontSize: 12 }}>{p.models.join(", ")}</td>
                <td>
                  {Object.keys(data.active).map((hostId) => (
                    <button
                      key={hostId}
                      style={{ marginRight: 6 }}
                      onClick={async () => {
                        try {
                          const d = await api.previewSwitch(p.id, hostId);
                          setPreview({ id: p.id, hostId, data: d });
                        } catch (e) {
                          setError(String(e));
                        }
                      }}
                    >
                      {HOST_NAMES[hostId] ?? hostId}
                    </button>
                  ))}
                </td>
                <td>
                  <button onClick={async () => { try { await api.deleteProvider(p.id); reload(); } catch (e) { setError(String(e)); } }}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data && (
        <p style={{ marginTop: 12 }}>
          当前激活:
          {Object.entries(data.active).map(([hostId, a]) => (
            <span key={hostId} style={{ marginRight: 12 }}>
              <b>{HOST_NAMES[hostId] ?? hostId}</b> = {a.model ?? "未知"}
            </span>
          ))}
        </p>
      )}

      <h3>新增档案</h3>
      <div style={{ display: "grid", gap: 6, maxWidth: 560 }}>
        <input placeholder="名称(如 ModelScope)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Base URL" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} />
        <input placeholder="API Key" type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
        <input placeholder="模型列表(逗号分隔)" value={form.models} onChange={(e) => setForm({ ...form, models: e.target.value })} />
        <button onClick={submit} disabled={!form.name || !form.baseUrl || !form.apiKey}>
          保存档案
        </button>
      </div>

      {preview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", padding: 20, maxWidth: 640, maxHeight: "80vh", overflow: "auto" }}>
            <h3>切换预览 · {HOST_NAMES[preview.hostId]}</h3>
            <p>目标文件:<code style={{ fontSize: 12 }}>{preview.data.file}</code></p>
            <p>生效模型:{preview.data.effectModel} · 当前:{preview.data.current.model ?? "未知"}</p>
            <pre style={{ background: "#f4f4f4", padding: 10, fontSize: 12, overflow: "auto" }}>
              {JSON.stringify(preview.data.ops, null, 2)}
            </pre>
            <p style={{ color: "#666", fontSize: 12 }}>写前会自动备份,可在备份列表回滚。</p>
            <button onClick={doSwitch}>确认切换</button>{" "}
            <button onClick={() => setPreview(null)}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}
