import { useCallback, useEffect, useRef } from "react";
import { bridge } from "../../shared/bridge";
import { DiffIcon, JumpIcon } from "../../shared/components/Icons";

interface IdeaShelfFileContextMenuProps {
  x: number;
  y: number;
  filePath: string;
  shelfName: string;
  onClose: () => void;
}

export function IdeaShelfFileContextMenu({
  x,
  y,
  filePath,
  shelfName,
  onClose,
}: IdeaShelfFileContextMenuProps) {
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
    bridge.request("showIdeaShelfFileDiff", { shelfName, filePath });
    onClose();
  }, [shelfName, filePath, onClose]);

  const handleJumpToSource = useCallback(() => {
    bridge.request("openFile", { filePath });
    onClose();
  }, [filePath, onClose]);

  return (
    <div className="commit-context-menu" ref={menuRef} style={style}>
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
