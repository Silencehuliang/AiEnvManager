import type { HostId } from "@aienv/shared";
import type { PatchOp } from "../engine/ops.js";
import type { ProviderProfile } from "../registry.js";

/** 切换预览:一张「将改哪些文件、哪些字段」的结构化清单 */
export interface SwitchPreview {
  hostId: HostId;
  files: SwitchFilePlan[];
  /** 生效模型标注 */
  effectModel: string;
  current: { slug: string | null; model: string | null };
}

export interface SwitchFilePlan {
  file: string;
  ops: PatchOp[];
  /** 文件不存在时用该内容先建空底(如 dsh settings.yaml 从 .imported 播种) */
  createIfMissing?: string;
}

/** 需要写盘引擎与数据目录的宿主适配器 */
export interface AdapterContext {
  engine: {
    patchFile(
      file: string,
      ops: PatchOp[],
      keep?: number,
    ): Promise<{ content: string; backup: string | null; changed: boolean }>;
    snapshot(file: string, keep?: number): Promise<string | null>;
  };
  homeDir: string;
  hostRoot: string;
}

/**
 * 供应商适配器:把共享档案翻译成宿主各自的配置格式(ADR-0002)。
 * 每家宿主一个实现;ZCode 适配器在结构 spike(T06)后补齐。
 */
export interface ProviderAdapter {
  id: HostId;
  name: string;
  /** 宿主配置里承载供应商的主文件 */
  providerFile: string;
  /** 宿主当前激活的供应商标识(无法判定时为 null) */
  readActive(): { slug: string | null; model: string | null };
  /** 生成切换到某档案的多文件补丁计划(不写盘) */
  switchPlan(profile: ProviderProfile): SwitchFilePlan[];
  effectModel: string;
}
