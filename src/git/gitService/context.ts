import type { GitCache } from "../cache";
import type { GitLogger } from "../types";

/** 传递给每个 gitService/* 模块的共享执行上下文（Git 执行、缓存、日志能力）。 */
export interface GitContext {
  readonly cwd: string;
  readonly logger?: GitLogger;
  readonly cache: GitCache;
  execGit(args: string[], maxBuffer?: number): Promise<string>;
  execGitBuffer(args: string[], maxBuffer?: number): Promise<Buffer>;
  invalidateCache(pattern?: string): void;
}
