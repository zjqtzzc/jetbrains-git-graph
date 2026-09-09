import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bridge } from "../../shared/bridge";
import {
  useCommitStore,
  type WorkingTreeFile,
} from "../../shared/store/commit-store";
import { CommitFileContextMenu } from "./CommitFileContextMenu";
import { CommitMessageArea } from "./CommitMessageArea";
import { FileItem } from "./FileItem";
import { Toolbar } from "./Toolbar";
import {
  buildGroupItems,
  collectDirFiles,
  collectFileKeys,
  countFiles,
  FolderRow,
} from "./TreeRow";

export function CommitTab() {
  const {
    changes,
    selectedFiles,
    highlightedFiles,
    expandedGroups,
    groupByDirectory,
    showUnversioned,
    toggleGroup,
    toggleFileSelection,
    setFileKeys,
    highlightFile,
    showDiff,
    fetchChanges,
    ideaShelveChanges,
  } = useCommitStore();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: WorkingTreeFile;
  } | null>(null);

  const [dirContextMenu, setDirContextMenu] = useState<{
    x: number;
    y: number;
    files: WorkingTreeFile[];
    dirName: string;
  } | null>(null);

  // Group files: staged (Changes) vs unstaged/untracked (Unversioned Files)
  const { stagedFiles, changedFiles, untrackedFiles, conflictedFiles } =
    useMemo(() => {
      const staged: WorkingTreeFile[] = [];
      const changed: WorkingTreeFile[] = [];
      const untracked: WorkingTreeFile[] = [];
      const conflicted: WorkingTreeFile[] = [];

      for (const file of changes) {
        if (file.status === "conflicted") {
          conflicted.push(file);
        } else if (file.staged) {
          staged.push(file);
        } else if (file.status === "untracked") {
          untracked.push(file);
        } else {
          changed.push(file);
        }
      }
      return {
        stagedFiles: staged,
        changedFiles: changed,
        untrackedFiles: untracked,
        conflictedFiles: conflicted,
      };
    }, [changes]);

  const handleShelveSelected = useCallback(async () => {
    const selectedPaths = changes
      .filter((f) => selectedFiles.has(`${f.path}:${f.staged}`))
      .map((f) => f.path);
    if (selectedPaths.length === 0) return;
    await ideaShelveChanges("Shelved changes", [...new Set(selectedPaths)]);
  }, [changes, selectedFiles, ideaShelveChanges]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, file: WorkingTreeFile) => {
      setContextMenu({ x: e.clientX, y: e.clientY, file });
      setDirContextMenu(null);
    },
    [],
  );

  const handleDirContextMenu = useCallback(
    (e: React.MouseEvent, files: WorkingTreeFile[], dirName: string) => {
      e.preventDefault();
      e.stopPropagation();
      setDirContextMenu({ x: e.clientX, y: e.clientY, files, dirName });
      setContextMenu(null);
    },
    [],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const closeDirContextMenu = useCallback(() => {
    setDirContextMenu(null);
  }, []);

  return (
    <div
      className="commit-tab-content"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      <Toolbar
        onRefresh={() => {
          fetchChanges();
          bridge.request("refreshGitState");
        }}
        onShelve={handleShelveSelected}
        onRollback={() => {
          // Use highlighted files (click/focus selection), not checkbox selection
          const highlightedPaths = changes
            .filter((f) => highlightedFiles.has(`${f.path}:${f.staged}`))
            .map((f) => ({ path: f.path, status: f.status, staged: f.staged }));

          if (highlightedPaths.length > 0) {
            bridge.request("openRollbackPanel", { files: highlightedPaths });
          } else {
            // No highlighted files: fall back to all working tree change files
            const allFiles = changes.map((f) => ({
              path: f.path,
              status: f.status,
              staged: f.staged,
            }));
            bridge.request("openRollbackPanel", { files: allFiles });
          }
        }}
        hasChanges={changes.length > 0}
      />

      <div className="commit-file-list">
        {/* Merge Conflicts */}
        {conflictedFiles.length > 0 && (
          <FileGroup
            label="Merge Conflicts"
            files={conflictedFiles}
            expanded={expandedGroups.has("conflicts")}
            groupByDirectory={groupByDirectory}
            onToggle={() => toggleGroup("conflicts")}
            selectedFiles={selectedFiles}
            highlightedFiles={highlightedFiles}
            onToggleFile={toggleFileSelection}
            onSetFileKeys={setFileKeys}
            onHighlightFile={highlightFile}
            onShowDiff={showDiff}
            onContextMenu={handleContextMenu}
            onDirContextMenu={handleDirContextMenu}
            action={
              <span
                className="commit-group-resolve-link"
                onClick={(e) => {
                  e.stopPropagation();
                  bridge.request("openConflictsPanel");
                }}
                onKeyDown={() => {}}
                role="button"
                tabIndex={0}
              >
                Resolve
              </span>
            }
          />
        )}

        {/* Changes (tracked, modified) */}
        {changedFiles.length > 0 && (
          <FileGroup
            label="Changes"
            files={changedFiles}
            expanded={expandedGroups.has("changes")}
            groupByDirectory={groupByDirectory}
            onToggle={() => toggleGroup("changes")}
            selectedFiles={selectedFiles}
            highlightedFiles={highlightedFiles}
            onToggleFile={toggleFileSelection}
            onSetFileKeys={setFileKeys}
            onHighlightFile={highlightFile}
            onShowDiff={showDiff}
            onContextMenu={handleContextMenu}
            onDirContextMenu={handleDirContextMenu}
          />
        )}

        {/* Staged files */}
        {stagedFiles.length > 0 && (
          <FileGroup
            label="Staged"
            files={stagedFiles}
            expanded={expandedGroups.has("staged")}
            groupByDirectory={groupByDirectory}
            onToggle={() => toggleGroup("staged")}
            selectedFiles={selectedFiles}
            highlightedFiles={highlightedFiles}
            onToggleFile={toggleFileSelection}
            onSetFileKeys={setFileKeys}
            onHighlightFile={highlightFile}
            onShowDiff={showDiff}
            onContextMenu={handleContextMenu}
            onDirContextMenu={handleDirContextMenu}
          />
        )}

        {/* Unversioned Files */}
        {showUnversioned && untrackedFiles.length > 0 && (
          <FileGroup
            label="Unversioned Files"
            files={untrackedFiles}
            expanded={expandedGroups.has("unversioned")}
            groupByDirectory={groupByDirectory}
            onToggle={() => toggleGroup("unversioned")}
            selectedFiles={selectedFiles}
            highlightedFiles={highlightedFiles}
            onToggleFile={toggleFileSelection}
            onSetFileKeys={setFileKeys}
            onHighlightFile={highlightFile}
            onShowDiff={showDiff}
            onContextMenu={handleContextMenu}
            onDirContextMenu={handleDirContextMenu}
          />
        )}

        {changes.length === 0 && (
          <div className="shelf-empty">No changes detected</div>
        )}
      </div>

      <CommitMessageArea />

      {contextMenu && (
        <CommitFileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file}
          onClose={closeContextMenu}
        />
      )}
      {dirContextMenu && (
        <DirContextMenu
          x={dirContextMenu.x}
          y={dirContextMenu.y}
          files={dirContextMenu.files}
          dirName={dirContextMenu.dirName}
          onClose={closeDirContextMenu}
        />
      )}
    </div>
  );
}

interface FileGroupProps {
  label: string;
  files: WorkingTreeFile[];
  expanded: boolean;
  groupByDirectory: boolean;
  onToggle: () => void;
  selectedFiles: Set<string>;
  highlightedFiles: Set<string>;
  onToggleFile: (key: string) => void;
  onSetFileKeys: (keys: string[], selected: boolean) => void;
  onHighlightFile: (key: string, mode: "single" | "toggle") => void;
  onShowDiff: (path: string, staged?: boolean) => Promise<void>;
  onContextMenu: (e: React.MouseEvent, file: WorkingTreeFile) => void;
  onDirContextMenu: (
    e: React.MouseEvent,
    files: WorkingTreeFile[],
    dirName: string,
  ) => void;
  action?: React.ReactNode;
}

function FileGroup({
  label,
  files,
  expanded,
  groupByDirectory,
  onToggle,
  selectedFiles,
  highlightedFiles,
  onToggleFile,
  onSetFileKeys,
  onHighlightFile,
  onShowDiff,
  onContextMenu,
  onDirContextMenu,
  action,
}: FileGroupProps) {
  const { collapsedDirs, toggleDir } = useCommitStore();

  // 分组标题本身也是一个 item（树的根节点），文件夹/文件都在它下面正常缩进，
  // 三种行统一走这一份数组 + 一次 .map()，不再分"标题 JSX + 目录树 + 扁平列表"
  const items = useMemo(
    () =>
      buildGroupItems(label, files, expanded, groupByDirectory, collapsedDirs),
    [label, files, expanded, groupByDirectory, collapsedDirs],
  );

  const visibleKeys = useMemo(
    () =>
      items
        .filter((item) => item.kind === "file")
        .map((item) => `${item.file.path}:${item.file.staged}`),
    [items],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();

      if (visibleKeys.length === 0) return;

      let currentIdx = -1;
      for (let i = 0; i < visibleKeys.length; i++) {
        if (highlightedFiles.has(visibleKeys[i])) {
          currentIdx = i;
          break;
        }
      }

      let nextIdx: number;
      if (e.key === "ArrowDown") {
        nextIdx =
          currentIdx < visibleKeys.length - 1 ? currentIdx + 1 : currentIdx;
      } else {
        nextIdx = currentIdx > 0 ? currentIdx - 1 : 0;
      }

      onHighlightFile(visibleKeys[nextIdx], "single");
    },
    [visibleKeys, highlightedFiles, onHighlightFile],
  );

  return (
    <div className="commit-group" tabIndex={0} onKeyDown={handleKeyDown}>
      {items.map((item) => {
        if (item.kind === "folder") {
          const { node, depth } = item;
          const isGroupRoot = node.fullPath === "";
          const childKeys = collectFileKeys(node);
          const allChecked =
            childKeys.length > 0 &&
            childKeys.every((k) => selectedFiles.has(k));
          const someChecked = childKeys.some((k) => selectedFiles.has(k));

          return (
            <FolderRow
              key={isGroupRoot ? "__group_root__" : node.fullPath}
              node={node}
              depth={depth}
              collapsed={
                isGroupRoot ? !expanded : collapsedDirs.has(node.fullPath)
              }
              fileCount={countFiles(node)}
              allChecked={allChecked}
              someChecked={someChecked}
              onToggle={isGroupRoot ? onToggle : () => toggleDir(node.fullPath)}
              onCheckboxChange={() => {
                if (allChecked) {
                  onSetFileKeys(childKeys, false);
                } else {
                  onSetFileKeys(childKeys, true);
                }
              }}
              onContextMenu={
                isGroupRoot
                  ? undefined
                  : (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDirContextMenu(e, collectDirFiles(node), node.name);
                    }
              }
              action={isGroupRoot ? action : undefined}
            />
          );
        }

        const { file, depth } = item;
        const key = `${file.path}:${file.staged}`;
        // 按目录分组时，目录嵌套已经表达了路径，行内只显示文件名；扁平模式下
        // 还是要看到完整相对路径（原来的行为）
        const displayFile = groupByDirectory
          ? { ...file, path: file.path.split("/").pop() || file.path }
          : file;

        return (
          <FileItem
            key={key}
            file={displayFile}
            depth={depth}
            showIndentSlot
            selected={selectedFiles.has(key)}
            highlighted={highlightedFiles.has(key)}
            onToggle={() => onToggleFile(key)}
            onShowDiff={() => onShowDiff(file.path, file.staged)}
            onContextMenu={(e) => onContextMenu(e, file)}
            onClick={(e) => {
              const mode = e.metaKey || e.ctrlKey ? "toggle" : "single";
              onHighlightFile(key, mode);
            }}
          />
        );
      })}
    </div>
  );
}

/* ─── Directory Context Menu ─────────────────────────────────────── */

function DirContextMenu({
  x,
  y,
  files,
  dirName,
  onClose,
}: {
  x: number;
  y: number;
  files: WorkingTreeFile[];
  dirName: string;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: y,
    left: x,
  });

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const viewportW = window.innerWidth;
      let top = y;
      let left = x;
      if (top + rect.height > viewportH) {
        const above = y - rect.height;
        top = above >= 4 ? above : Math.max(4, viewportH - rect.height - 4);
      }
      if (left + rect.width > viewportW) {
        left = Math.max(4, viewportW - rect.width - 4);
      }
      setPosition({ top, left });
    });
  }, [x, y]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleScroll = (e: Event) => {
      if (
        menuRef.current &&
        e.target instanceof Node &&
        !menuRef.current.contains(e.target)
      )
        onClose();
    };
    document.addEventListener("mousedown", handleClick, true);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("blur", onClose);
    document.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", handleClick, true);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("blur", onClose);
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const handleDelete = useCallback(() => {
    const paths = files.map((f) => f.path);
    import("../../shared/bridge").then(({ bridge }) => {
      bridge.request("deleteFiles", { filePaths: paths });
    });
    onClose();
  }, [files, onClose]);

  const handleRollback = useCallback(() => {
    const paths = files.map((f) => f.path);
    import("../../shared/bridge").then(({ bridge }) => {
      bridge.request("rollbackFiles", { filePaths: paths });
    });
    onClose();
  }, [files, onClose]);

  const handleOpenInSystemFolder = useCallback(() => {
    const firstFile = files[0];
    if (firstFile) {
      import("../../shared/bridge").then(({ bridge }) => {
        bridge.request("revealInSystemExplorer", { filePath: firstFile.path });
      });
    }
    onClose();
  }, [files, onClose]);

  return (
    <div
      className="commit-context-menu"
      ref={menuRef}
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
        zIndex: 1000,
      }}
    >
      <button
        type="button"
        className="commit-context-menu-item"
        onClick={handleRollback}
      >
        <RollbackIcon />
        <span>Rollback...</span>
      </button>

      <div className="commit-context-menu-separator" />

      <button
        type="button"
        className="commit-context-menu-item"
        onClick={handleOpenInSystemFolder}
      >
        <FolderOpenIcon />
        <span>Open in System Folder</span>
      </button>

      <div className="commit-context-menu-separator" />

      <button
        type="button"
        className="commit-context-menu-item"
        onClick={handleDelete}
      >
        <DeleteDirIcon />
        <span>Delete "{dirName}"...</span>
        <span className="commit-context-menu-shortcut">⌫</span>
      </button>
    </div>
  );
}

function FolderOpenIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="commit-context-menu-icon"
    >
      <path
        d="M1.5 3.5C1.5 2.95 1.95 2.5 2.5 2.5H5.5L7 4H13.5C14.05 4 14.5 4.45 14.5 5V12.5C14.5 13.05 14.05 13.5 13.5 13.5H2.5C1.95 13.5 1.5 13.05 1.5 12.5V3.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeleteDirIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="commit-context-menu-icon"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7 2H9C9.55228 2 10 2.44772 10 3H6C6 2.44772 6.44772 2 7 2ZM5 3C5 1.89543 5.89543 1 7 1H9C10.1046 1 11 1.89543 11 3H13C13.5523 3 14 3.44772 14 4V5V6H13V13C13 14.1046 12.1046 15 11 15H5C3.89543 15 3 14.1046 3 13V6H2V5V4C2 3.44772 2.44772 3 3 3H5ZM11 4H10H6H5H3V5H4H12H13V4H11ZM4 6H12V13C12 13.5523 11.5523 14 11 14H5C4.44772 14 4 13.5523 4 13V6ZM6.5 7C6.22386 7 6 7.22386 6 7.5V11.5C6 11.7761 6.22386 12 6.5 12C6.77614 12 7 11.7761 7 11.5V7.5C7 7.22386 6.77614 7 6.5 7ZM9 7.5C9 7.22386 9.22386 7 9.5 7C9.77614 7 10 7.22386 10 7.5V11.5C10 11.7761 9.77614 12 9.5 12C9.22386 12 9 11.7761 9 11.5V7.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** expui/vcs/revert.svg */
function RollbackIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="commit-context-menu-icon"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.85363 1.85355C6.04889 1.65829 6.04889 1.34171 5.85363 1.14645C5.65837 0.951184 5.34178 0.951184 5.14652 1.14645L1.64652 4.64645L1.29297 5L1.64652 5.35355L5.14652 8.85355C5.34178 9.04882 5.65837 9.04882 5.85363 8.85355C6.04889 8.65829 6.04889 8.34171 5.85363 8.14645L3.20718 5.5H10.5001C12.4331 5.5 14.0001 7.067 14.0001 9C14.0001 10.933 12.4331 12.5 10.5001 12.5H5.50008C5.22393 12.5 5.00008 12.7239 5.00008 13C5.00008 13.2761 5.22393 13.5 5.50008 13.5H10.5001C12.9854 13.5 15.0001 11.4853 15.0001 9C15.0001 6.51472 12.9854 4.5 10.5001 4.5H3.20718L5.85363 1.85355Z"
        fill="currentColor"
      />
    </svg>
  );
}
