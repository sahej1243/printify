export type PageRangeResult = { selectedCount: number; error: null } | { selectedCount: 0; error: string };

export function parsePageRange(input: string, pageCount: number): PageRangeResult {
  const value = input.trim().toLowerCase();
  if (value === "all") {
    return { selectedCount: pageCount, error: null };
  }
  if (!value) return { selectedCount: 0, error: "Choose all pages or enter a page range." };

  const intervals: Array<[number, number]> = [];
  for (const rawPart of value.split(",")) {
    const part = rawPart.trim();
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!match) return { selectedCount: 0, error: "Use a format like 1-4, 7." };
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    if (start < 1 || end < start) return { selectedCount: 0, error: "Page numbers must be positive and ranges must go from low to high." };
    if (end > pageCount) return { selectedCount: 0, error: `This PDF has ${pageCount} pages. Choose pages within that range.` };
    intervals.push([start, end]);
  }
  intervals.sort(([a], [b]) => a - b);
  for (let index = 1; index < intervals.length; index += 1) {
    if (intervals[index][0] <= intervals[index - 1][1]) {
      return { selectedCount: 0, error: "Page ranges cannot overlap or select a page twice." };
    }
  }
  return { selectedCount: intervals.reduce((count, [start, end]) => count + end - start + 1, 0), error: null };
}
