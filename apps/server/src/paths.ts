import os from "node:os";
import path from "node:path";
import type { HostId } from "@aienv/shared";

export interface HostDef {
  id: HostId;
  name: string;
  /** 宿主配置根相对于用户主目录的路径 */
  relativeRoot: string[];
  /** 根之下被本工具管理的真实配置(相对路径;目录以 / 结尾) */
  configPaths: string[];
}

export const HOST_DEFS: HostDef[] = [
  {
    id: "zcode",
    name: "ZCode",
    relativeRoot: [".zcode"],
    configPaths: [
      "cli/config.json",
      "v2/provider_config.json",
      "v2/credentials.json",
      "agents/",
      "plugins/installed_plugins.json",
    ],
  },
  {
    id: "codex",
    name: "Codex",
    relativeRoot: [".codex"],
    configPaths: ["config.toml"],
  },
  {
    id: "opencode",
    name: "OpenCode",
    relativeRoot: [".config", "opencode"],
    configPaths: ["opencode.json", "skills/"],
  },
  {
    id: "dsh",
    name: "dsh",
    relativeRoot: [".dsh"],
    configPaths: ["profiles/", ".credentials.yaml"],
  },
];

export interface AppPaths {
  homeDir: string;
  hostRoots: Record<HostId, string>;
  /** 本工具自身数据目录 ~/.aienvmanager */
  dataDir: string;
}

export function resolvePaths(homeDir?: string): AppPaths {
  const home = homeDir ?? os.homedir();
  const hostRoots = {} as Record<HostId, string>;
  for (const def of HOST_DEFS) {
    hostRoots[def.id] = path.join(home, ...def.relativeRoot);
  }
  return { homeDir: home, hostRoots, dataDir: path.join(home, ".aienvmanager") };
}
