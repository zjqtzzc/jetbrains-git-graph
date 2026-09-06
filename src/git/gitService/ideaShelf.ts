import { readFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { IdeaShelfEntry } from "../types";
import type { GitContext } from "./context";

/** 扫描 `.idea/shelf` 目录下的 XML 元数据文件，解析为 IDEA 风格 shelf 条目列表（按日期倒序）。 */
export async function getIdeaShelves(
  ctx: GitContext,
): Promise<IdeaShelfEntry[]> {
  const shelfDir = path.join(ctx.cwd, ".idea", "shelf");
  try {
    await fs.access(shelfDir);
  } catch {
    return [];
  }

  const entries: IdeaShelfEntry[] = [];
  const dirContents = await fs.readdir(shelfDir);

  for (const item of dirContents) {
    if (!item.endsWith(".xml")) continue;
    const xmlPath = path.join(shelfDir, item);
    try {
      const xmlContent = await fs.readFile(xmlPath, "utf-8");
      const entry = parseIdeaShelfXml(ctx, xmlContent, shelfDir, xmlPath);
      if (entry) entries.push(entry);
    } catch {
      // skip malformed entries
    }
  }

  // Sort by date descending (newest first)
  entries.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  return entries;
}

/** 解析单个 shelf 的 `<changelist>` XML 元数据，并读取对应 patch 文件涉及的文件列表。 */
function parseIdeaShelfXml(
  ctx: GitContext,
  xmlContent: string,
  shelfDir: string,
  xmlPath: string,
): IdeaShelfEntry | null {
  // Parse: <changelist name="..." date="..." recycled="...">
  const nameMatch = xmlContent.match(/changelist\s+name="([^"]*)"/);
  const dateMatch = xmlContent.match(/\bdate="(\d+)"/);
  const pathMatch = xmlContent.match(/option\s+name="PATH"\s+value="([^"]*)"/);
  const descMatch = xmlContent.match(
    /option\s+name="DESCRIPTION"\s+value="([^"]*)"/,
  );

  if (!nameMatch || !pathMatch) return null;

  const name = nameMatch[1];
  const dateMs = dateMatch ? Number.parseInt(dateMatch[1], 10) : Date.now();
  const date = new Date(dateMs).toISOString();
  const description = descMatch?.[1] ?? "";

  // Resolve $PROJECT_DIR$ to workspace root
  const patchRelative = pathMatch[1].replace(/\$PROJECT_DIR\$/g, ctx.cwd);
  const patchPath = path.isAbsolute(patchRelative)
    ? patchRelative
    : path.join(shelfDir, patchRelative);

  // Parse files from patch
  const files = parseFilesFromPatchPath(patchPath);

  return { name, description, date, patchPath, xmlPath, files };
}

/** 同步读取 patch 文件并解析出其中涉及的文件路径，读取失败时返回空数组。 */
function parseFilesFromPatchPath(patchPath: string): string[] {
  try {
    const content = readFileSync(patchPath, "utf-8");
    return parseFilesFromPatch(content);
  } catch {
    return [];
  }
}

/** 从 patch 文本中提取涉及的文件路径列表（识别 `diff --git` 和 `Index:` 两种格式）。 */
function parseFilesFromPatch(patchContent: string): string[] {
  const files: string[] = [];
  const lines = patchContent.split("\n");
  for (const line of lines) {
    // Match: diff --git a/path b/path
    const diffMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (diffMatch) {
      files.push(diffMatch[2]);
      continue;
    }
    // Match: Index: path
    const indexMatch = line.match(/^Index:\s+(.+)$/);
    if (indexMatch) {
      files.push(indexMatch[1]);
    }
  }
  return [...new Set(files)];
}

/**
 * 创建一个 IDEA 风格 shelf：为指定文件（或全部改动）生成 patch 并写入
 * `.idea/shelf/<name>/shelved.patch`，同时写出 XML 元数据，最后从工作区还原这些改动。
 */
export async function ideaShelveChanges(
  ctx: GitContext,
  message: string,
  filePaths?: string[],
): Promise<void> {
  const shelfDir = path.join(ctx.cwd, ".idea", "shelf");
  await fs.mkdir(shelfDir, { recursive: true });

  const sanitizedName = sanitizeShelfName(message || "Changes");
  const uniqueName = await getUniqueShelfName(shelfDir, sanitizedName);

  // Create shelf subdirectory
  const entryDir = path.join(shelfDir, uniqueName);
  await fs.mkdir(entryDir, { recursive: true });

  // Generate patch
  let patchContent = "";
  if (filePaths && filePaths.length > 0) {
    patchContent = await generatePatchForFiles(ctx, filePaths);
  } else {
    patchContent = await generatePatchAll(ctx);
  }

  if (!patchContent.trim()) {
    // Clean up empty directory
    await fs.rm(entryDir, { recursive: true, force: true });
    throw new Error("No changes to shelve");
  }

  // Write patch file
  const patchFilePath = path.join(entryDir, "shelved.patch");
  await fs.writeFile(patchFilePath, patchContent, "utf-8");

  // Write XML metadata
  const timestamp = Date.now();
  const xmlContent = `<changelist name="${escapeXml(uniqueName)}" date="${timestamp}" recycled="false">\n  <option name="PATH" value="$PROJECT_DIR$/.idea/shelf/${uniqueName}/shelved.patch" />\n  <option name="DESCRIPTION" value="${escapeXml(message || "")}" />\n</changelist>\n`;
  const xmlPath = path.join(shelfDir, `${uniqueName}.xml`);
  await fs.writeFile(xmlPath, xmlContent, "utf-8");

  // Revert the files in working tree
  if (filePaths && filePaths.length > 0) {
    await revertFiles(ctx, filePaths);
  } else {
    await revertAllChanges(ctx);
  }

  ctx.invalidateCache();
}

/** 应用指定 shelf 的 patch 到工作区（优先 `--3way`），`drop` 为 true 时应用后删除该 shelf。 */
export async function ideaUnshelveChanges(
  ctx: GitContext,
  shelfName: string,
  drop?: boolean,
): Promise<void> {
  const entry = await findIdeaShelfEntry(ctx, shelfName);
  if (!entry) {
    throw new Error(`Shelf "${shelfName}" not found`);
  }

  try {
    const patchContent = await fs.readFile(entry.patchPath, "utf-8");
    if (patchContent.trim()) {
      // Apply patch using git apply
      try {
        await ctx.execGit(["apply", "--3way", entry.patchPath]);
      } catch {
        // Try without --3way as fallback
        await ctx.execGit(["apply", entry.patchPath]);
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to apply shelf "${shelfName}": ${message}`);
  }

  if (drop) {
    await deleteIdeaShelf(ctx, shelfName);
  }

  ctx.invalidateCache();
}

/** 删除指定 shelf 的 patch 目录（或 patch 文件）及其 XML 元数据；已不存在时视为幂等成功。 */
export async function deleteIdeaShelf(
  ctx: GitContext,
  shelfName: string,
): Promise<void> {
  const entry = await findIdeaShelfEntry(ctx, shelfName);
  if (!entry) {
    // Already gone (e.g. deleted concurrently) — deleting is idempotent.
    return;
  }
  const shelfDir = path.join(ctx.cwd, ".idea", "shelf");
  const entryDir = path.dirname(entry.patchPath);

  // Delete the patch directory. If the patch lives directly in the shared
  // shelf root (no per-entry subfolder), only remove the patch file itself
  // so other entries aren't affected.
  try {
    if (entryDir === shelfDir) {
      await fs.unlink(entry.patchPath);
    } else {
      await fs.rm(entryDir, { recursive: true, force: true });
    }
  } catch {
    // ignore
  }

  // Delete XML file
  try {
    await fs.unlink(entry.xmlPath);
  } catch {
    // ignore
  }
}

/** 按 changelist 名称查找对应的 shelf 条目，得到其真实的磁盘路径。 */
async function findIdeaShelfEntry(
  ctx: GitContext,
  shelfName: string,
): Promise<IdeaShelfEntry | null> {
  const entries = await getIdeaShelves(ctx);
  const match = entries.find((e) => e.name === shelfName);
  return match ?? null;
}

/** 将任意字符串清理为可安全用作文件/目录名的形式（替换非法字符、折叠下划线、限长）。 */
function sanitizeShelfName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 100);
}

/** 将外部传入的 patch 内容直接导入为一个新的 IDEA 风格 shelf 条目。 */
export async function importPatchAsShelf(
  ctx: GitContext,
  name: string,
  patchContent: string,
): Promise<void> {
  const shelfDir = path.join(ctx.cwd, ".idea", "shelf");
  await fs.mkdir(shelfDir, { recursive: true });

  const sanitized = sanitizeShelfName(name || "Imported");
  const shelfName = await getUniqueShelfName(shelfDir, sanitized);

  // Create shelf directory and write patch
  const entryDir = path.join(shelfDir, shelfName);
  await fs.mkdir(entryDir, { recursive: true });
  await fs.writeFile(
    path.join(entryDir, "shelved.patch"),
    patchContent,
    "utf-8",
  );

  // Write XML metadata
  const now = Date.now();
  const xml = `<changelist name="${shelfName}" date="${now}" recycled="false">\n  <option name="PATH" value="$PROJECT_DIR$/.idea/shelf/${shelfName}/shelved.patch" />\n  <option name="DESCRIPTION" value="${shelfName}" />\n</changelist>\n`;
  await fs.writeFile(path.join(shelfDir, `${shelfName}.xml`), xml, "utf-8");
}

/** 在 shelf 目录下为 baseName 找一个不冲突的唯一名称（重名时依次追加数字后缀）。 */
async function getUniqueShelfName(
  shelfDir: string,
  baseName: string,
): Promise<string> {
  let candidate = baseName;
  let counter = 1;
  while (true) {
    const xmlPath = path.join(shelfDir, `${candidate}.xml`);
    try {
      await fs.access(xmlPath);
      // File exists, try next
      candidate = `${baseName}${counter}`;
      counter++;
    } catch {
      // File doesn't exist, use this name
      return candidate;
    }
  }
}

/** 为指定文件生成 patch：已跟踪文件走 `git diff`，未跟踪文件手写 unified diff 格式。 */
async function generatePatchForFiles(
  ctx: GitContext,
  filePaths: string[],
): Promise<string> {
  let patch = "";

  // Separate tracked and untracked files
  const tracked: string[] = [];
  const untracked: string[] = [];

  for (const filePath of filePaths) {
    try {
      await ctx.execGit(["ls-files", "--error-unmatch", filePath]);
      tracked.push(filePath);
    } catch {
      untracked.push(filePath);
    }
  }

  // Generate diff for tracked files (staged + unstaged)
  if (tracked.length > 0) {
    try {
      const diff = await ctx.execGit(["diff", "HEAD", "--", ...tracked]);
      patch += diff;
    } catch {
      // If HEAD doesn't exist (initial commit), diff against empty tree
      try {
        const diff = await ctx.execGit(["diff", "--cached", "--", ...tracked]);
        patch += diff;
      } catch {
        // ignore
      }
    }
  }

  // Generate patch for untracked files
  for (const filePath of untracked) {
    const fullPath = path.join(ctx.cwd, filePath);
    try {
      const content = await fs.readFile(fullPath, "utf-8");
      const lines = content.split("\n");
      patch += `diff --git a/${filePath} b/${filePath}\n`;
      patch += "new file mode 100644\n";
      patch += "--- /dev/null\n";
      patch += `+++ b/${filePath}\n`;
      patch += `@@ -0,0 +1,${lines.length} @@\n`;
      for (const line of lines) {
        patch += `+${line}\n`;
      }
    } catch {
      // skip files that can't be read
    }
  }

  return patch;
}

/** 为工作区全部改动（含未跟踪文件）生成 patch。 */
async function generatePatchAll(ctx: GitContext): Promise<string> {
  let patch = "";

  // Get diff for all tracked changes
  try {
    const diff = await ctx.execGit(["diff", "HEAD"]);
    patch += diff;
  } catch {
    try {
      const diff = await ctx.execGit(["diff", "--cached"]);
      patch += diff;
    } catch {
      // ignore
    }
  }

  // Get untracked files
  try {
    const untrackedOutput = await ctx.execGit([
      "ls-files",
      "--others",
      "--exclude-standard",
    ]);
    const untrackedFiles = untrackedOutput.trim().split("\n").filter(Boolean);

    for (const filePath of untrackedFiles) {
      const fullPath = path.join(ctx.cwd, filePath);
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        const lines = content.split("\n");
        patch += `diff --git a/${filePath} b/${filePath}\n`;
        patch += "new file mode 100644\n";
        patch += "--- /dev/null\n";
        patch += `+++ b/${filePath}\n`;
        patch += `@@ -0,0 +1,${lines.length} @@\n`;
        for (const line of lines) {
          patch += `+${line}\n`;
        }
      } catch {
        // skip binary or unreadable files
      }
    }
  } catch {
    // ignore
  }

  return patch;
}

/** 还原指定文件在工作区的改动：已跟踪文件恢复为 HEAD 版本，未跟踪文件直接删除。 */
async function revertFiles(
  ctx: GitContext,
  filePaths: string[],
): Promise<void> {
  for (const filePath of filePaths) {
    try {
      await ctx.execGit(["ls-files", "--error-unmatch", filePath]);
      // Tracked file: checkout from HEAD
      await ctx.execGit(["checkout", "HEAD", "--", filePath]);
    } catch {
      // Untracked file: delete it
      const fullPath = path.join(ctx.cwd, filePath);
      try {
        await fs.unlink(fullPath);
      } catch {
        // ignore
      }
    }
  }
}

/** 还原工作区的全部改动：已跟踪文件恢复为 HEAD 版本，并清理未跟踪文件。 */
async function revertAllChanges(ctx: GitContext): Promise<void> {
  // Reset tracked files
  try {
    await ctx.execGit(["checkout", "HEAD", "--", "."]);
  } catch {
    // ignore (e.g. no HEAD yet)
  }
  // Remove untracked files
  try {
    await ctx.execGit(["clean", "-fd"]);
  } catch {
    // ignore
  }
}

/** 转义字符串中的 XML 特殊字符，用于写入 shelf 的元数据文件。 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
