import { useCallback, useEffect, useState } from "react";

const HOST_NAMES: Record<string, string> = { zcode: "ZCode", codex: "Codex", opencode: "OpenCode", dsh: "dsh" };
const LAYER_LABEL: Record<string, string> = { builtin: "内置(只读)", user: "用户全局", project: "项目" };

interface SkillItem {
  id: string;
  name: string;
  layer: string;
  hosts: string[];
  description?: string;
  project?: string;
  disabled: boolean;
  provenance: string;
}

interface SkillsResponse {
  items: SkillItem[];
  projects: { root: string; markers: string[] }[];
}

interface SettingsShape {
  scanRoots: string[];
  excludes: string[];
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
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

export default function SkillsPage() {
  const [data, setData] = useState<SkillsResponse | null>(null);
  const [roots, setRoots] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [install, setInstall] = useState<{ source: string; targetLayer: "user" | "project"; project: string; name: string }>({
    source: "",
    targetLayer: "user",
    project: "",
    name: "",
  });

  const reload = useCallback(() => {
    fetch("/api/skills")
      .then((r) => r.json() as Promise<SkillsResponse>)
      .then(setData)
      .catch((e) => setError(String(e)));
    fetch("/api/settings")
      .then((r) => r.json() as Promise<SettingsShape>)
      .then((s) => setRoots(s.scanRoots.join("\n")))
      .catch(() => undefined);
  }, []);
  useEffect(reload, [reload]);

  const saveRoots = async () => {
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scanRoots: roots.split("\n").map((s) => s.trim()).filter(Boolean) }),
      });
      reload();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div>
      <h2>Skills(三层盘点)</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <h3>项目扫描根(每行一个)</h3>
      <textarea rows={3} style={{ width: 480 }} value={roots} onChange={(e) => setRoots(e.target.value)} />
      <div>
        <button onClick={saveRoots}>保存扫描根</button>
      </div>
      <p style={{ color: "#666", fontSize: 13 }}>
        发现项目:{data ? data.projects.length : 0} 个(dsh 技能经 cordis 插件体系,不在此盘点)
      </p>
      {data && (
        <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #333" }}>
              <th>层级</th>
              <th>Skill</th>
              {Object.keys(HOST_NAMES).map((h) => (
                <th key={h}>{HOST_NAMES[h]}</th>
              ))}
              <th>来源态</th>
              <th>操作</th>
              <th>描述</th>
            </tr>
          </thead>
          <tbody>
            {(["builtin", "user", "project"] as const).flatMap((layer) =>
              data.items
                .filter((i) => i.layer === layer)
                .map((i) => (
                  <tr key={i.id} style={{ borderBottom: "1px solid #ddd", opacity: i.disabled ? 0.5 : 1 }}>
                    <td>{LAYER_LABEL[layer]}</td>
                    <td>{i.name}</td>
                    {Object.keys(HOST_NAMES).map((h) => (
                      <td key={h}>{i.hosts.includes(h) ? (i.disabled ? "🚫" : "✓") : "—"}</td>
                    ))}
                    <td style={{ fontSize: 12 }}>
                      {i.provenance === "managed" ? "托管" : i.provenance === "conflicting" ? "冲突" : "外来"}
                    </td>
                    <td>
                      {layer !== "builtin" && (
                        <button
                          onClick={async () => {
                            try {
                              await postJson("/api/skills/toggle", { id: i.id, enabled: i.disabled });
                              reload();
                            } catch (e) {
                              setError(String(e));
                            }
                          }}
                        >
                          {i.disabled ? "启用" : "禁用"}
                        </button>
                      )}
                      {layer === "user" && (
                        <button
                          style={{ marginLeft: 4 }}
                          onClick={async () => {
                            const project = prompt("目标项目根(留空跳过复制):");
                            if (!project) return;
                            try {
                              await postJson("/api/skills/copy", { id: i.id, toLayer: "project", project });
                              reload();
                            } catch (e) {
                              setError(String(e));
                            }
                          }}
                        >
                          复制到项目
                        </button>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: "#555" }}>{i.description ?? ""}</td>
                  </tr>
                )),
            )}
          </tbody>
        </table>
      )}

      <h3>安装 Skill(本地目录 / owner/repo / git URL)</h3>
      <div style={{ display: "grid", gap: 6, maxWidth: 560 }}>
        <input placeholder="来源" value={install.source} onChange={(e) => setInstall({ ...install, source: e.target.value })} />
        <select
          value={install.targetLayer}
          onChange={(e) => setInstall({ ...install, targetLayer: e.target.value as "user" | "project" })}
        >
          <option value="user">用户全局(~/.agents/skills)</option>
          <option value="project">项目层</option>
        </select>
        {install.targetLayer === "project" && (
          <input placeholder="项目根路径" value={install.project} onChange={(e) => setInstall({ ...install, project: e.target.value })} />
        )}
        <input placeholder="名称(默认取目录名)" value={install.name} onChange={(e) => setInstall({ ...install, name: e.target.value })} />
        <button
          disabled={!install.source}
          onClick={async () => {
            try {
              await postJson("/api/skills/install", install);
              setInstall({ source: "", targetLayer: "user", project: "", name: "" });
              reload();
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          安装
        </button>
      </div>
    </div>
  );
}
