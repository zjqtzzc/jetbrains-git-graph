import { useCallback, useEffect, useRef } from "react";
import {
  CheckIcon,
  DeleteIcon,
  UnshelveIcon,
} from "../../shared/components/Icons";
import type { ShelveEntry } from "../../shared/store/commit-store";
import { useCommitStore } from "../../shared/store/commit-store";

interface ShelfContextMenuProps {
  x: number;
  y: number;
  entry: ShelveEntry;
  onClose: () => void;
}

export function ShelfContextMenu({
  x,
  y,
  entry,
  onClose,
}: ShelfContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { unshelveChanges, deleteShelve } = useCommitStore();

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

  const handleUnshelve = useCallback(() => {
    unshelveChanges(entry.id, true);
    onClose();
  }, [entry, unshelveChanges, onClose]);

  const handleApply = useCallback(() => {
    unshelveChanges(entry.id, false);
    onClose();
  }, [entry, unshelveChanges, onClose]);

  const handleDelete = useCallback(() => {
    deleteShelve(entry.id);
    onClose();
  }, [entry, deleteShelve, onClose]);

  return (
    <div className="commit-context-menu" ref={menuRef} style={style}>
      <button
        type="button"
        className="commit-context-menu-item"
        onClick={handleUnshelve}
      >
        <UnshelveIcon className="commit-context-menu-icon" />
        <span>Unshelve...</span>
        <span className="commit-context-menu-shortcut">⇧⌘U</span>
      </button>

      <button
        type="button"
        className="commit-context-menu-item"
        onClick={handleApply}
      >
        <CheckIcon className="commit-context-menu-icon" />
        <span>Restore</span>
      </button>

      <div className="commit-context-menu-separator" />

      <button
        type="button"
        className="commit-context-menu-item"
        onClick={handleDelete}
      >
        <DeleteIcon className="commit-context-menu-icon" />
        <span>Delete...</span>
        <span className="commit-context-menu-shortcut">⌫</span>
      </button>
    </div>
  );
}

/* ─── Icons ──────────────────────────────────────────────────────── */
