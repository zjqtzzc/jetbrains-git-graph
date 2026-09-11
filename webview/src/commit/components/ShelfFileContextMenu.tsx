import { useCallback, useEffect, useRef } from "react";
import { bridge } from "../../shared/bridge";
import {
  DiffIcon,
  JumpIcon,
  UnshelveIcon,
} from "../../shared/components/Icons";

interface ShelfFileContextMenuProps {
  x: number;
  y: number;
  filePath: string;
  stashId: string;
  onClose: () => void;
}

export function ShelfFileContextMenu({
  x,
  y,
  filePath,
  stashId,
  onClose,
}: ShelfFileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const style: React.CSSProperties = {
    position: "fixed",
    left: x,
    top: y,
    zIndex: 1000,
  };

  const handleShowDiff = useCallback(() => {
    bridge.request("showShelfFileDiff", { stashId, filePath });
    onClose();
  }, [stashId, filePath, onClose]);

  const handleUnshelveFile = useCallback(() => {
    bridge.request("unshelveFile", { stashId, filePath });
    onClose();
  }, [stashId, filePath, onClose]);

  const handleJumpToSource = useCallback(() => {
    bridge.request("openFile", { filePath });
    onClose();
  }, [filePath, onClose]);

  return (
    <div className="commit-context-menu" ref={menuRef} style={style}>
      <button
        type="button"
        className="commit-context-menu-item"
        onClick={handleUnshelveFile}
      >
        <UnshelveIcon className="commit-context-menu-icon" />
        <span>Unshelve This File</span>
      </button>

      <div className="commit-context-menu-separator" />

      <button
        type="button"
        className="commit-context-menu-item"
        onClick={handleShowDiff}
      >
        <DiffIcon className="commit-context-menu-icon" />
        <span>Show Diff</span>
        <span className="commit-context-menu-shortcut">⌘D</span>
      </button>

      <button
        type="button"
        className="commit-context-menu-item"
        onClick={handleJumpToSource}
      >
        <JumpIcon className="commit-context-menu-icon" />
        <span>Jump to Source</span>
      </button>
    </div>
  );
}

/* ─── Icons ──────────────────────────────────────────────────────── */
