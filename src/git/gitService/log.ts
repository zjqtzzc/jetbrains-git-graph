import { computeGraphLayout } from "../graphLayout";
import type {
  CommitNode,
  GraphLayoutResult,
  LaneSnapshot,
  LogOptions,
} from "../types";
import { FMT_RECORD_SEP, LOG_FORMAT } from "./constants";
import type { GitContext } from "./context";
import { parseLogOutput } from "./parsers";

/** 按筛选条件（分支/作者/搜索词/时间范围等）获取提交列表，结果按 `LogOptions` 序列化后缓存。 */
export async function getLog(
  ctx: GitContext,
  options: LogOptions = {},
): Promise<CommitNode[]> {
  const cacheKey = `log:${JSON.stringify(options)}`;
  const cached = ctx.cache.get<CommitNode[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const args = [
    "log",
    `--format=${LOG_FORMAT}${FMT_RECORD_SEP}`,
    "--date-order",
  ];

  if (options.maxCount) {
    args.push(`--max-count=${options.maxCount}`);
  } else {
    args.push("--max-count=200");
  }
  if (options.skip) {
    args.push(`--skip=${options.skip}`);
  }
  if (options.author) {
    args.push(`--author=${options.author}`);
  }
  if (options.search) {
    args.push(`--grep=${options.search}`);
  }
  if (options.since) {
    args.push(`--since=${options.since}`);
  }
  if (options.until) {
    args.push(`--until=${options.until}`);
  }
  if (options.branch) {
    args.push(options.branch);
  } else {
    args.push("--all");
  }
  if (options.file) {
    args.push("--", options.file);
  }

  const output = await ctx.execGit(args);
  const commits = parseLogOutput(output);
  ctx.cache.set(cacheKey, commits);
  return commits;
}

/** 获取提交列表并计算图形布局（车道分配 + 连线），供 Git Graph 面板渲染。 */
export async function getGraphTopology(
  ctx: GitContext,
  options: LogOptions = {},
  prevSnapshot?: LaneSnapshot,
): Promise<GraphLayoutResult> {
  const commits = await getLog(ctx, options);
  const breakHiddenParents = !!options.search;
  return computeGraphLayout(commits, prevSnapshot, breakHiddenParents);
}

/** 获取指定提交的所有父提交哈希（`hash^@`）。 */
export async function getCommitParents(
  ctx: GitContext,
  hash: string,
): Promise<string[]> {
  const output = await ctx.execGit(["rev-parse", `${hash}^@`]).catch(() => "");
  return output
    .trim()
    .split("\n")
    .filter((s) => s.length > 0);
}

/** 获取 HEAD 最新一次提交的完整提交信息（`%B`）。 */
export async function getLastCommitMessage(ctx: GitContext): Promise<string> {
  try {
    const output = await ctx.execGit(["log", "-1", "--format=%B"]);
    return output.trim();
  } catch {
    return "";
  }
}

/** 获取最近 N 条提交的标题（`%s`），用于提交信息输入框的历史建议。 */
export async function getRecentCommitMessages(
  ctx: GitContext,
  count = 20,
): Promise<string[]> {
  try {
    const output = await ctx.execGit(["log", `-${count}`, "--format=%s"]);
    return output
      .trim()
      .split("\n")
      .filter((msg) => msg.length > 0);
  } catch {
    return [];
  }
}
