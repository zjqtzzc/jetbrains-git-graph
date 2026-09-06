// 用于解析 git 输出（真正的 null 字节）
export const FIELD_SEP = "\x00";
export const RECORD_SEP = "\x00\x00\x01";
// 用于 git log --format（pretty-format）：%x00 会产生 null 字节
export const FMT_FIELD_SEP = "%x00";
export const FMT_RECORD_SEP = "%x00%x00%x01";
// 用于 git branch/tag --format（ref-format / for-each-ref）：%00 会产生 null 字节
export const REF_FMT_FIELD_SEP = "%00";

export const LOG_FORMAT = [
  "%H", // hash
  "%h", // shortHash
  "%P", // parents (space separated)
  "%aN", // authorName (mailmap resolved)
  "%aE", // authorEmail (mailmap resolved)
  "%aI", // authorDate ISO 8601
  "%s", // subject
  "%b", // body
  "%D", // refs
].join(FMT_FIELD_SEP);
