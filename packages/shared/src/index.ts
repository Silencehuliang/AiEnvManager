/** 四家被管理宿主的唯一标识 */
export type HostId = "zcode" | "codex" | "opencode" | "dsh";

/** 资源层级(ADR-0003):内置只读 / 用户全局 / 项目 */
export type Layer = "builtin" | "user" | "project";

/** 资源来源态(CONTEXT.md):托管 / 外来 / 冲突 */
export type Provenance = "managed" | "unmanaged" | "conflicting";

/** 生效模型:改了之后何时生效 */
export type EffectModel = "hot-reload" | "next-request" | "next-session" | "restart";

export const EFFECT_MODEL_LABEL: Record<EffectModel, string> = {
  "hot-reload": "热重载",
  "next-request": "下次请求",
  "next-session": "下次会话",
  restart: "需重启",
};

export interface HostInfo {
  id: HostId;
  name: string;
  detected: boolean;
  /** 宿主配置根目录 */
  root: string;
  /** 该宿主被本工具管理的真实配置文件路径 */
  configPaths: string[];
}

export interface HostsResponse {
  hosts: HostInfo[];
}
