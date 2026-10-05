import { useEffect, useState } from "react";
import type { HostsResponse } from "@aienv/shared";
import { api } from "./api.js";

export default function App() {
  const [data, setData] = useState<HostsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.hosts().then(setData).catch((e) => setError(String(e)));
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", margin: "2rem", maxWidth: 900 }}>
      <h1>AiEnvManager</h1>
      <p>四宿主 AI Agent 环境管理台(v1)</p>
      {error && <p style={{ color: "crimson" }}>加载失败:{error}</p>}
      {!data && !error && <p>加载中…</p>}
      {data && (
        <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #333" }}>
              <th>宿主</th>
              <th>状态</th>
              <th>配置根</th>
              <th>管理的真实配置</th>
            </tr>
          </thead>
          <tbody>
            {data.hosts.map((h) => (
              <tr key={h.id} style={{ borderBottom: "1px solid #ddd" }}>
                <td>{h.name}</td>
                <td>{h.detected ? "✅ 已安装" : "⚪ 未检测到"}</td>
                <td style={{ fontFamily: "monospace", fontSize: 12 }}>{h.root}</td>
                <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                  {h.configPaths.map((p) => (
                    <div key={p}>{p}</div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
