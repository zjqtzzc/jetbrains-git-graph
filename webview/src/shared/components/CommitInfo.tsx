import type { Commit } from "../types/git";
import { RefTagIcon } from "./Icons";

/** Renders text with URLs highlighted as clickable links */
function Linkify({ text }: { text: string }) {
  const urlRegex = /(https?:\/\/[^\s<>]+)/g;
  const parts = text.split(urlRegex);

  return (
    <>
      {parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a
            key={`link-${i}-${part.slice(0, 20)}`}
            href={part}
            style={{ color: "#3574f0", textDecoration: "none" }}
            target="_blank"
            rel="noopener noreferrer"
          >
            {part}
          </a>
        ) : (
          <span key={`text-${i}`}>{part}</span>
        ),
      )}
    </>
  );
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

/** Icon colors matching IDEA */
const iconColors: Record<string, string> = {
  branch: "#59a869",
  "remote-branch": "#9b7dd4",
  tag: "#c4a000",
  HEAD: "#e06c75",
};

/**
 * Reusable commit info display component.
 * Shows commit message, metadata (hash, author, date), and ref tags.
 */
export function CommitInfo({ commit }: { commit: Commit }) {
  const displayRefs = commit.refs.filter(
    (r) => !(r.type === "remote-branch" && r.name.endsWith("/HEAD")),
  );

  return (
    <div>
      {/* Commit message - with link highlighting */}
      <div
        style={{
          fontWeight: 600,
          fontSize: "1.05em",
          lineHeight: 1.4,
          marginBottom: 4,
        }}
      >
        <Linkify text={commit.subject} />
      </div>
      {commit.body && (
        <div
          style={{
            whiteSpace: "pre-wrap",
            lineHeight: 1.5,
            color: "var(--description-fg)",
            marginBottom: 8,
          }}
        >
          <Linkify text={commit.body} />
        </div>
      )}

      {/* Metadata: hash + author + email + date */}
      <div
        style={{
          fontSize: "0.92em",
          color: "var(--description-fg)",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--editor-font)",
            fontSize: "var(--editor-font-size)",
          }}
        >
          {commit.shortHash}
        </span>{" "}
        {commit.authorName}{" "}
        {commit.authorEmail && (
          <>
            <a
              href={`mailto:${commit.authorEmail}`}
              style={{ color: "#3574f0", textDecoration: "none" }}
            >
              &lt;{commit.authorEmail}&gt;
            </a>{" "}
          </>
        )}
        on {formatDateTime(commit.authorDate)}
      </div>

      {/* Ref icons + text */}
      {displayRefs.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {displayRefs.map((r, i) => {
            const color = iconColors[r.type] ?? iconColors.branch;
            const label = r.type === "HEAD" ? "HEAD" : r.name;
            return (
              <span
                key={`${r.type}:${r.name}:${i}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: "0.85em",
                  whiteSpace: "nowrap",
                }}
                title={r.name}
              >
                <RefTagIcon size={12} color={color} />
                <span>{label}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
