import { useEffect, useState } from "react";
import type { HostsResponse } from "@aienv/shared";
import { api, type ProvidersResponse } from "./api.js";
import ProvidersPage from "./pages/ProvidersPage.js";
import SkillsPage from "./pages/SkillsPage.js";
import McpPage from "./pages/McpPage.js";
import PluginsPage from "./pages/PluginsPage.js";

const HOST_NAMES: Record<string, string> = {
  zcode: "ZCode",
  codex: "Codex",
  opencode: "OpenCode",
  dsh: "dsh",
};

const PAGES = [
  { id: "overview", label: "总览" },
  { id: "providers", label: "供应商" },
  { id: "skills", label: "Skills" },
  { id: "mcp", label: "MCP" },
  { id: "plugins", label: "插件" },
] as const;

type PageId = (typeof PAGES)[number]["id"];

export default function App() {
  const [page, setPage] = useState<PageId>("overview");
  const [data, setData] = useState<HostsResponse | null>(null);
  const [providers, setProviders] = useState<ProvidersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (page === "overview") {
      api.hosts().then(setData).catch((e) => setError(String(e)));
      api.providers().then(setProviders).catch(() => setProviders(null));
    }
  }, [page]);

  return (
    <div style={{ display: "flex", fontFamily: "system-ui, sans-serif", minHeight: "100vh" }}>
      <nav style={{ width: 160, borderRight: "1px solid #ddd", padding: 16 }}>
        <h2 style={{ fontSize: 16 }}>AiEnvManager</h2>
        {PAGES.map((p) => (
          <div
            key={p.id}
            onClick={() => setPage(p.id)}
            style={{
              padding: "6px 8px",
              borderRadius: 6,
              cursor: "pointer",
              background: page === p.id ? "#e8f0fe" : "transparent",
              fontWeight: page === p.id ? 600 : 400,
            }}
          >
            {p.label}
          </div>
        ))}
      </nav>
      <main style={{ flex: 1, padding: 24, maxWidth: 1000 }}>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        {page === "overview" && (
          <div>
            <h1>总览</h1>
            {!data && <p>加载中…</p>}
            {data && (
              <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "2px solid #333" }}>
                    <th>宿主</th>
                    <th>状态</th>
                    <th>当前供应商</th>
                    <th>配置根</th>
                  </tr>
                </thead>
                <tbody>
                  {data.hosts.map((h) => (
                    <tr key={h.id} style={{ borderBottom: "1px solid #ddd" }}>
                      <td>{h.name}</td>
                      <td>{h.detected ? "✅ 已安装" : "⚪ 未检测到"}</td>
                      <td>{providers?.active[h.id]?.model ?? "—"}</td>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{h.root}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        {page === "providers" && <ProvidersPage />}
        {page === "skills" && <SkillsPage />}
        {page === "mcp" && <McpPage />}
        {page === "plugins" && <PluginsPage />}
      </main>
    </div>
  );
}
