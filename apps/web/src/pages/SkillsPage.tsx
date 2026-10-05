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
}

interface SkillsResponse {
  items: SkillItem[];
  projects: { root: string; markers: string[] }[];
}

interface SettingsShape {
  scanRoots: string[];
  excludes: string[];
}

export default function SkillsPage() {
  const [data, setData] = useState<SkillsResponse | null>(null);
  const [roots, setRoots] = useState("");
  const [error, setError] = useState<string | null>(null);

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
                    <td style={{ fontSize: 12, color: "#555" }}>{i.description ?? ""}</td>
                  </tr>
                )),
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
