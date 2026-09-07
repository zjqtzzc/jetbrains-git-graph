import type React from "react";
import type { ComponentType } from "react";
import {
  resolveSetiIcon,
  SETI_FONT_FAMILY,
  SETI_FONT_SIZE_MULTIPLIER,
} from "./seti-icon-theme";

// --- Folder icons (IntelliJ IDEA style) ---
export function IconFolder({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ verticalAlign: "middle", color: "#8c8c8c", ...style }}
    >
      <path
        d="M8.10584 4.34613L8.25344 4.5H8.46667H13C13.8284 4.5 14.5 5.17157 14.5 6V12.1333C14.5 12.9529 13.932 13.5 13.3667 13.5H2.63333C2.06804 13.5 1.5 12.9529 1.5 12.1333V3.86667C1.5 3.04707 2.06804 2.5 2.63333 2.5H6.1217C6.25792 2.5 6.38824 2.55557 6.48253 2.65387L8.10584 4.34613Z"
        fill="currentColor"
        fillOpacity={0.15}
        stroke="currentColor"
      />
    </svg>
  );
}

export function IconFolderOpen({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ verticalAlign: "middle", color: "#8c8c8c", ...style }}
    >
      <path
        d="M8.10584 4.34613L8.25344 4.5H8.46667H13C13.8284 4.5 14.5 5.17157 14.5 6V12.1333C14.5 12.9529 13.932 13.5 13.3667 13.5H2.63333C2.06804 13.5 1.5 12.9529 1.5 12.1333V3.86667C1.5 3.04707 2.06804 2.5 2.63333 2.5H6.1217C6.25792 2.5 6.38824 2.55557 6.48253 2.65387L8.10584 4.34613Z"
        fill="currentColor"
        fillOpacity={0.15}
        stroke="currentColor"
      />
    </svg>
  );
}

type IconComponent = ComponentType<{ style?: React.CSSProperties }>;

/**
 * Get file icon, resolved from a bundled snapshot of VS Code's own Seti icon
 * theme (see seti-icon-theme.ts) so the look matches the native Explorer.
 */
export function getFileIcon(filePath: string): IconComponent {
  const seti = resolveSetiIcon(filePath);
  return function FileIconRenderer({ style }: { style?: React.CSSProperties }) {
    if (!seti) return null;
    return (
      <span
        style={{
          fontFamily: SETI_FONT_FAMILY,
          fontWeight: "normal",
          color: seti.color,
          fontSize: `calc(var(--font-size) * ${SETI_FONT_SIZE_MULTIPLIER})`,
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          ...style,
        }}
      >
        {seti.char}
      </span>
    );
  };
}
