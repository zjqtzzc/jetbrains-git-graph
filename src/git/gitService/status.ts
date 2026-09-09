import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { FileStatus, WorkingTreeFile } from "../types";
import type { GitContext } from "./context";

/** 获取工作区文件状态列表（`git status --porcelain=v1`），含重命名识别。 */
export async function getStatus(ctx: GitContext): Promise<FileStatus[]> {
  const output = await ctx.execGit(["status", "--porcelain=v1"]);
  const files: FileStatus[] = [];

  for (const line of output.split("\n")) {
    if (line.length < 4) {
      continue;
    }
    const indexStatus = line[0];
    const workTreeStatus = line[1];
    const rest = line.substring(3);

    // Handle renames: "R  old -> new"
    const arrowIdx = rest.indexOf(" -> ");
    if (arrowIdx !== -1) {
      files.push({
        path: rest.substring(arrowIdx + 4),
        oldPath: rest.substring(0, arrowIdx),
        indexStatus,
        workTreeStatus,
      });
    } else {
      files.push({
        path: rest,
        indexStatus,
        workTreeStatus,
      });
    }
  }
  return files;
}

/**
 * 获取提交面板所需的工作区改动列表（含未跟踪文件），并归类为
 * added/modified/deleted/renamed/untracked/conflicted 等状态；
 * 同一文件既有暂存又有未暂存改动时会拆分为两条记录分别展示。
 */
export async function getWorkingTreeChanges(
  ctx: GitContext,
): Promise<WorkingTreeFile[]> {
  const output = await ctx.execGit(["status", "--porcelain=v1", "-uall"]);
  const files: WorkingTreeFile[] = [];

  for (const line of output.split("\n")) {
    if (line.length < 4) continue;
    const indexStatus = line[0];
    const workTreeStatus = line[1];

    // Skip ignored files
    if (indexStatus === "!" && workTreeStatus === "!") continue;

    const rest = line.substring(3);

    // Handle renames
    const arrowIdx = rest.indexOf(" -> ");
    const filePath = arrowIdx !== -1 ? rest.substring(arrowIdx + 4) : rest;
    const oldPath = arrowIdx !== -1 ? rest.substring(0, arrowIdx) : undefined;

    // Determine if file is staged
    const staged =
      indexStatus !== " " && indexStatus !== "?" && indexStatus !== "!";

    // Determine status
    let status: WorkingTreeFile["status"];
    if (indexStatus === "?" && workTreeStatus === "?") {
      status = "untracked";
    } else if (
      indexStatus === "U" ||
      workTreeStatus === "U" ||
      (indexStatus === "A" && workTreeStatus === "A") ||
      (indexStatus === "D" && workTreeStatus === "D")
    ) {
      status = "conflicted";
    } else if (indexStatus === "A" || workTreeStatus === "A") {
      status = "added";
    } else if (indexStatus === "D" || workTreeStatus === "D") {
      status = "deleted";
    } else if (indexStatus === "R" || workTreeStatus === "R") {
      status = "renamed";
    } else {
      status = "modified";
    }

    // For files that have both staged and unstaged changes, emit two entries
    if (
      staged &&
      workTreeStatus !== " " &&
      workTreeStatus !== "?" &&
      workTreeStatus !== "!"
    ) {
      // Staged version
      files.push({ path: filePath, oldPath, status, staged: true });
      // Unstaged version
      files.push({
        path: filePath,
        oldPath,
        status: "modified",
        staged: false,
      });
    } else {
      files.push({ path: filePath, oldPath, status, staged });
    }
  }
  return files;
}

/** 将指定文件加入暂存区。 */
export async function stageFiles(
  ctx: GitContext,
  filePaths: string[],
): Promise<void> {
  if (filePaths.length === 0) return;
  await ctx.execGit(["add", "--", ...filePaths]);
}

/** 将指定文件从暂存区移除（不影响工作区内容）。 */
export async function unstageFile(
  ctx: GitContext,
  filePath: string,
): Promise<void> {
  await ctx.execGit(["reset", "HEAD", "--", filePath]);
}

/** 取消暂存所有文件。 */
export async function unstageAll(ctx: GitContext): Promise<void> {
  await ctx.execGit(["reset", "HEAD"]);
}

/** 将所有改动（含未跟踪文件）加入暂存区。 */
export async function stageAll(ctx: GitContext): Promise<void> {
  await ctx.execGit(["add", "-A"]);
}

/** 提交暂存区的改动，`amend` 为 true 时修补上一次提交。 */
export async function commit(
  ctx: GitContext,
  message: string,
  amend = false,
): Promise<void> {
  const args = ["commit", "-m", message];
  if (amend) args.push("--amend");
  await ctx.execGit(args);
  ctx.invalidateCache();
}

/** 撤销单个文件的所有改动：HEAD 中存在则恢复为 HEAD 版本，否则视为新文件直接删除。 */
export async function rollbackFile(
  ctx: GitContext,
  filePath: string,
): Promise<void> {
  // Check if file exists in HEAD (i.e., was previously committed)
  let existsInHead = false;
  try {
    await ctx.execGit(["cat-file", "-e", `HEAD:${filePath}`]);
    existsInHead = true;
  } catch {
    existsInHead = false;
  }

  if (existsInHead) {
    // File exists in HEAD - restore to HEAD version (handles both staged and unstaged changes)
    await ctx.execGit(["checkout", "HEAD", "--", filePath]);
  } else {
    // File is new (not in HEAD) - remove from index and delete from disk
    try {
      await ctx.execGit(["rm", "-f", "--cached", "--", filePath]);
    } catch {
      // Not in index either, nothing to unstage
    }
    const fullPath = path.join(ctx.cwd, filePath);
    try {
      await fs.unlink(fullPath);
    } catch {
      // File already doesn't exist on disk
    }
  }
}
