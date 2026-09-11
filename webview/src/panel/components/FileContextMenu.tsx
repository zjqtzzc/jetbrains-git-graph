import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { bridge, bridgeWithProgress } from "../../shared/bridge";
import {
  CherryPickIcon,
  DiffIcon,
  EditIcon,
  RollbackIcon,
} from "../../shared/components/Icons";
import { usePanelStore } from "../../shared/store/panel-store";
import type { DiffFile } from "../../shared/types/git";

interface FileContextMenuProps {
  x: number;
  y: number;
  file: DiffFile;
  onClose: () => void;
}

export function FileContextMenu({ x, y, file, onClose }: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedCommitHash = usePanelStore((s) => s.selectedCommitHash);
  const openDiffEditor = usePanelStore((s) => s.openDiffEditor);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const filePath = file.newPath || file.oldPath;

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
        if (above >= 4) {
          top = above;
        } else {
          top = Math.max(4, viewportH - rect.height - 4);
        }
      }
      if (left + rect.width > viewportW) {
        left = Math.max(4, viewportW - rect.width - 4);
      }

      setPosition({ top, left });
    });
  }, [x, y]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleBlur = () => onClose();
    const handleScroll = (e: Event) => {
      if (
        menuRef.current &&
        e.target instanceof Node &&
        !menuRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    const handleContextMenu = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("contextmenu", handleContextMenu, true);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleBlur);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("contextmenu", handleContextMenu, true);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleBlur);
    };
  }, [onClose]);

  const handleShowDiff = () => {
    onClose();
    if (selectedCommitHash) {
      openDiffEditor(selectedCommitHash, file);
    }
  };

  const handleEditSource = async () => {
    onClose();
    try {
      await bridge.request("openFile", { filePath });
    } catch (err) {
      console.error("Open file failed:", err);
    }
  };

  const handleOpenRepoVersion = async () => {
    onClose();
    if (selectedCommitHash) {
      try {
        await bridge.request("openFileAtRevision", {
          filePath,
          ref: selectedCommitHash,
        });
      } catch (err) {
        console.error("Open repo version failed:", err);
      }
    }
  };

  const handleRevertFileChanges = async () => {
    onClose();
    if (!selectedCommitHash) return;
    const result = (await bridge.request("showConfirmMessage", {
      message: `Revert changes to '${filePath.split("/").pop()}' from this commit?`,
      confirmLabel: "Revert",
    })) as { confirmed: boolean };
    if (!result.confirmed) return;
    try {
      await bridgeWithProgress("revertFileChanges", {
        hash: selectedCommitHash,
        filePath,
        status: file.status,
      });
    } catch (err) {
      console.error("Revert file changes failed:", err);
    }
  };

  const handleCherryPickFileChanges = async () => {
    onClose();
    if (!selectedCommitHash) return;
    const result = (await bridge.request("showConfirmMessage", {
      message: `Apply changes to '${filePath.split("/").pop()}' from this commit to working tree?`,
      confirmLabel: "Apply",
    })) as { confirmed: boolean };
    if (!result.confirmed) return;
    try {
      await bridgeWithProgress("cherryPickFileChanges", {
        hash: selectedCommitHash,
        filePath,
      });
    } catch (err) {
      console.error("Cherry-pick file changes failed:", err);
    }
  };

  const handleHistoryUpToHere = () => {
    onClose();
    usePanelStore.getState().setFilter({ file: filePath });
  };

  const items: {
    label: string;
    action: () => void;
    separator?: boolean;
    icon?: React.ReactNode;
  }[] = [
    { label: "Show Diff", action: handleShowDiff, icon: <DiffIcon /> },
    { label: "", action: () => {}, separator: true },
    { label: "Edit Source", action: handleEditSource, icon: <EditIcon /> },
    { label: "Open Repository Version", action: handleOpenRepoVersion },
    { label: "", action: () => {}, separator: true },
    {
      label: "Revert Selected Changes",
      action: handleRevertFileChanges,
      icon: <RollbackIcon />,
    },
    {
      label: "Cherry-Pick Selected Changes",
      action: handleCherryPickFileChanges,
      icon: <CherryPickIcon />,
    },
    { label: "", action: () => {}, separator: true },
    { label: "History Up to Here", action: handleHistoryUpToHere },
  ];

  const menu = (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: position ? position.top : -9999,
        left: position ? position.left : -9999,
        zIndex: 9999,
        background: "var(--vscode-menu-background, #1e1e1e)",
        border: "1px solid var(--vscode-menu-border, #454545)",
        borderRadius: 4,
        padding: "4px 0",
        minWidth: 180,
        maxHeight: "calc(100vh - 8px)",
        overflowY: "auto",
        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        visibility: position ? "visible" : "hidden",
      }}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div
            key={`sep-${i}`}
            style={{
              height: 1,
              background: "var(--vscode-menu-separatorBackground, #454545)",
              margin: "4px 0",
            }}
          />
        ) : (
          <div
            key={item.label}
            onClick={item.action}
            style={{
              padding: "6px 12px",
              cursor: "pointer",
              color: "var(--vscode-menu-foreground, #ccc)",
              fontSize: "13px",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "var(--vscode-list-hoverBackground, #2a2d2e)";
              (e.currentTarget as HTMLElement).style.color =
                "var(--vscode-menu-selectionForeground, #fff)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color =
                "var(--vscode-menu-foreground, #ccc)";
            }}
          >
            <span style={{ width: 14, flexShrink: 0, opacity: 0.7 }}>
              {item.icon ?? null}
            </span>
            {item.label}
          </div>
        ),
      )}
    </div>
  );

  return createPortal(menu, document.body);
}
