export function countWords(markdown: string): number {
  if (!markdown) return 0;
  const cleaned = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~\-]/g, " ");
  const cjk = (cleaned.match(/[\u4e00-\u9fff]/g) || []).length;
  const latin = (
    cleaned
      .replace(/[\u4e00-\u9fff]/g, " ")
      .trim()
      .match(/[a-zA-Z0-9]+/g) || []
  ).length;
  return cjk + latin;
}

export function estimateReadingMinutes(markdown: string): number {
  const words = countWords(markdown);
  return Math.max(1, Math.ceil(words / 320));
}

export function normalizeDateSortKey(dateStr: string): number {
  if (!dateStr) return 0;
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{1,4})-(\d{1,2})-(\d{1,2})/);
  if (!match) {
    const ts = Date.parse(trimmed);
    return Number.isNaN(ts) ? 0 : ts;
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  return year * 10000 + month * 100 + day;
}

export function extractYear(dateStr: string): string {
  if (!dateStr) return "未知";
  const match = dateStr.trim().match(/^(\d{1,4})-/);
  return match ? match[1] : dateStr.slice(0, 4);
}

export function makeSlug(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `post-${Date.now().toString(36)}`;
}
