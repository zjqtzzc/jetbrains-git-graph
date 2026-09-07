// One-off snapshot extracted from a local VS Code install's built-in
// `theme-seti` extension (icons/vs-seti-icon-theme.json + icons/seti.woff)
// plus the file-extension/filename declarations of its built-in language
// extensions (extensions/*/package.json contributes.languages). Not
// auto-regenerated — re-extract by hand if it ever needs updating.
import setiData from "./seti-icon-theme-data.json";

export const SETI_FONT_FAMILY = "seti-icons";
// vs-seti-icon-theme.json's `fonts[0].size` is "150%" — Seti's glyphs have
// internal padding and need to render at 1.5x the nominal icon slot size to
// visually fill it the way an image-based icon theme would.
export const SETI_FONT_SIZE_MULTIPLIER = 1.5;

export interface SetiIcon {
  char: string;
  color?: string;
}

interface SetiIconThemeData {
  fontBase64: string;
  iconDefinitions: Record<
    string,
    { fontCharacter: string; fontColor?: string }
  >;
  fileNames: Record<string, string>;
  fileExtensions: Record<string, string>;
  languageIds: Record<string, string>;
  defaultFileIconId: string;
  extensionToLanguageId: Record<string, string>;
  fileNameToLanguageId: Record<string, string>;
}

const theme = setiData as SetiIconThemeData;

function injectFontFace() {
  const style = document.createElement("style");
  style.textContent = `
@font-face {
  font-family: "${SETI_FONT_FAMILY}";
  src: url(data:font/woff;base64,${theme.fontBase64}) format("woff");
  font-weight: normal;
  font-style: normal;
}
`;
  document.head.appendChild(style);
}
injectFontFace();

function fontCharacterToChar(fontCharacter: string): string {
  const hex = fontCharacter.replace(/^\\/, "");
  return String.fromCodePoint(Number.parseInt(hex, 16));
}

function resolveIconDefId(fileName: string): string | undefined {
  const lower = fileName.toLowerCase();

  const byName = theme.fileNames[lower];
  if (byName) return byName;

  const segments = lower.split(".");
  if (segments.length >= 3) {
    const twoPart = segments.slice(-2).join(".");
    const byTwoPartExt = theme.fileExtensions[twoPart];
    if (byTwoPartExt) return byTwoPartExt;
  }
  if (segments.length >= 2) {
    const ext = segments[segments.length - 1];
    const byExt = theme.fileExtensions[ext];
    if (byExt) return byExt;
  }

  const languageId =
    theme.fileNameToLanguageId[lower] ??
    (segments.length >= 2
      ? theme.extensionToLanguageId[segments[segments.length - 1]]
      : undefined);
  if (languageId) {
    const byLanguage = theme.languageIds[languageId];
    if (byLanguage) return byLanguage;
  }

  return undefined;
}

/** Resolves a file path to a Seti icon glyph. */
export function resolveSetiIcon(filePath: string): SetiIcon | null {
  const fileName = filePath.split("/").pop() ?? filePath;
  const defId = resolveIconDefId(fileName) ?? theme.defaultFileIconId;
  const def = theme.iconDefinitions[defId];
  if (!def) return null;
  return { char: fontCharacterToChar(def.fontCharacter), color: def.fontColor };
}
