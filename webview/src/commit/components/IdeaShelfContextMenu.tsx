import { useCallback, useEffect, useRef } from "react";
import {
  CheckIcon,
  DeleteIcon,
  DownloadIcon,
  PatchIcon,
  UnshelveIcon,
} from "../../shared/components/Icons";
import type { IdeaShelfEntry } from "../../shared/store/commit-store";
import { useCommitStore } from "../../shared/store/commit-store";

interface IdeaShelfContextMenuProps {
  x: number;
  y: number;
  entry: IdeaShelfEntry;
  onClose: () => void;
}

export function IdeaShelfContextMenu({
  x,
  y,
  entry,
  onClose,
}: IdeaShelfContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { ideaUnshelveChanges, deleteIdeaShelf } = useCommitStore();

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
    ideaUnshelveChanges(entry.name, true);
    onClose();
  }, [entry, ideaUnshelveChanges, onClose]);

  const handleApply = useCallback(() => {
    ideaUnshelveChanges(entry.name, false);
    onClose();
  }, [entry, ideaUnshelveChanges, onClose]);

  const handleCreatePatch = useCallback(() => {
    import("../../shared/bridge").then(({ bridge }) => {
      bridge.request("createPatchFromShelf", { shelfName: entry.name });
    });
    onClose();
  }, [entry, onClose]);

  const handleImportPatches = useCallback(() => {
    import("../../shared/bridge").then(({ bridge }) => {
      bridge.request("importPatches");
    });
    onClose();
  }, [onClose]);

  const handleDelete = useCallback(() => {
    deleteIdeaShelf(entry.name);
    onClose();
  }, [entry, deleteIdeaShelf, onClose]);

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
        onClick={handleCreatePatch}
      >
        <PatchIcon className="commit-context-menu-icon" />
        <span>Create Patch...</span>
      </button>

      <button
        type="button"
        className="commit-context-menu-item"
        onClick={handleImportPatches}
      >
        <DownloadIcon className="commit-context-menu-icon" />
        <span>Import Patches...</span>
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
