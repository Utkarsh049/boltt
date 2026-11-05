import { BoltResponse, KeyValue } from "../store/requestStore";

export type DiffType = "unchanged" | "added" | "removed" | "modified";

export interface DiffLine {
  type: DiffType;
  oldLineNumber?: number;
  newLineNumber?: number;
  text: string;
}

export interface SplitDiffRow {
  left?: {
    lineNumber: number;
    text: string;
    type: DiffType;
  };
  right?: {
    lineNumber: number;
    text: string;
    type: DiffType;
  };
}

export interface HeaderDiff {
  key: string;
  oldValue?: string;
  newValue?: string;
  type: "added" | "removed" | "modified" | "unchanged";
}

export interface ResponseDiffSummary {
  statusDiff?: {
    oldStatus: number;
    newStatus: number;
    oldStatusText: string;
    newStatusText: string;
  };
  sizeDiff: {
    oldBytes: number;
    newBytes: number;
    deltaBytes: number;
  };
  timeDiff?: {
    oldMs: number;
    newMs: number;
    deltaMs: number;
  };
  headerDiffs: HeaderDiff[];
  additions: number;
  deletions: number;
  unchanged: number;
}

export interface ResponseDiffResult {
  summary: ResponseDiffSummary;
  unifiedDiff: DiffLine[];
  splitDiff: SplitDiffRow[];
  isIdentical: boolean;
}

/**
 * Normalizes JSON with sorted keys and uniform 2-space indentation
 * to avoid false-positive line diffs caused by key ordering or formatting discrepancies.
 * Falls back to raw text for non-JSON payloads.
 */
export const normalizeForDiff = (content: string): string => {
  if (!content || !content.trim()) return "";
  try {
    const parsed = JSON.parse(content);
    return sortAndStringifyJson(parsed);
  } catch {
    return content.replace(/\r\n/g, "\n");
  }
};

const sortAndStringifyJson = (val: unknown): string => {
  const sortKeysRecursively = (item: unknown): unknown => {
    if (item === null || typeof item !== "object") {
      return item;
    }
    if (Array.isArray(item)) {
      return item.map(sortKeysRecursively);
    }
    const sortedObj: Record<string, unknown> = {};
    const keys = Object.keys(item as Record<string, unknown>).sort();
    for (const key of keys) {
      sortedObj[key] = sortKeysRecursively((item as Record<string, unknown>)[key]);
    }
    return sortedObj;
  };

  return JSON.stringify(sortKeysRecursively(val), null, 2);
};

/**
 * Computes Longest Common Subsequence matrix between two arrays of lines.
 */
const computeLcsTable = (oldLines: string[], newLines: string[]): number[][] => {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
};

/**
 * Generates unified diff line list with line numbers and diff tags.
 */
export const computeUnifiedDiff = (oldText: string, newText: string): DiffLine[] => {
  const oldLines = oldText ? oldText.split("\n") : [];
  const newLines = newText ? newText.split("\n") : [];

  const dp = computeLcsTable(oldLines, newLines);
  const diff: DiffLine[] = [];

  let i = oldLines.length;
  let j = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diff.unshift({
        type: "unchanged",
        oldLineNumber: i,
        newLineNumber: j,
        text: oldLines[i - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({
        type: "added",
        newLineNumber: j,
        text: newLines[j - 1],
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diff.unshift({
        type: "removed",
        oldLineNumber: i,
        text: oldLines[i - 1],
      });
      i--;
    }
  }

  return diff;
};

/**
 * Generates side-by-side aligned split diff rows.
 */
export const computeSplitDiff = (unifiedDiff: DiffLine[]): SplitDiffRow[] => {
  const rows: SplitDiffRow[] = [];
  let pendingRemoved: DiffLine[] = [];
  let pendingAdded: DiffLine[] = [];

  const flushPending = () => {
    const maxLen = Math.max(pendingRemoved.length, pendingAdded.length);
    for (let k = 0; k < maxLen; k++) {
      const rem = pendingRemoved[k];
      const add = pendingAdded[k];

      rows.push({
        left: rem
          ? {
              lineNumber: rem.oldLineNumber!,
              text: rem.text,
              type: "removed",
            }
          : undefined,
        right: add
          ? {
              lineNumber: add.newLineNumber!,
              text: add.text,
              type: "added",
            }
          : undefined,
      });
    }
    pendingRemoved = [];
    pendingAdded = [];
  };

  for (const item of unifiedDiff) {
    if (item.type === "unchanged") {
      flushPending();
      rows.push({
        left: {
          lineNumber: item.oldLineNumber!,
          text: item.text,
          type: "unchanged",
        },
        right: {
          lineNumber: item.newLineNumber!,
          text: item.text,
          type: "unchanged",
        },
      });
    } else if (item.type === "removed") {
      pendingRemoved.push(item);
    } else if (item.type === "added") {
      pendingAdded.push(item);
    }
  }

  flushPending();
  return rows;
};

/**
 * Compares headers between two responses, identifying added, removed, and modified headers.
 */
export const compareHeaders = (oldHeaders: KeyValue[], newHeaders: KeyValue[]): HeaderDiff[] => {
  const oldMap = new Map<string, string>();
  for (const h of oldHeaders) {
    oldMap.set(h.key.toLowerCase(), h.value);
  }

  const newMap = new Map<string, string>();
  for (const h of newHeaders) {
    newMap.set(h.key.toLowerCase(), h.value);
  }

  const allKeys = Array.from(new Set([...oldMap.keys(), ...newMap.keys()])).sort();
  const diffs: HeaderDiff[] = [];

  for (const key of allKeys) {
    const hasOld = oldMap.has(key);
    const hasNew = newMap.has(key);
    const oldVal = oldMap.get(key);
    const newVal = newMap.get(key);

    const originalKey =
      newHeaders.find((h) => h.key.toLowerCase() === key)?.key ||
      oldHeaders.find((h) => h.key.toLowerCase() === key)?.key ||
      key;

    if (!hasOld && hasNew) {
      diffs.push({ key: originalKey, newValue: newVal, type: "added" });
    } else if (hasOld && !hasNew) {
      diffs.push({ key: originalKey, oldValue: oldVal, type: "removed" });
    } else if (oldVal !== newVal) {
      diffs.push({ key: originalKey, oldValue: oldVal, newValue: newVal, type: "modified" });
    } else {
      diffs.push({ key: originalKey, oldValue: oldVal, newValue: newVal, type: "unchanged" });
    }
  }

  return diffs;
};

/**
 * Master comparison function that contrasts two full BoltResponse objects,
 * including status code, byte size, network latency, headers, and body diffs.
 */
export const diffResponses = (
  baselineRes: BoltResponse,
  currentRes: BoltResponse
): ResponseDiffResult => {
  const oldNormalized = normalizeForDiff(baselineRes.body);
  const newNormalized = normalizeForDiff(currentRes.body);

  const unifiedDiff = computeUnifiedDiff(oldNormalized, newNormalized);
  const splitDiff = computeSplitDiff(unifiedDiff);
  const headerDiffs = compareHeaders(baselineRes.headers, currentRes.headers);

  let additions = 0;
  let deletions = 0;
  let unchanged = 0;

  for (const line of unifiedDiff) {
    if (line.type === "added") additions++;
    else if (line.type === "removed") deletions++;
    else unchanged++;
  }

  const isIdentical =
    baselineRes.status === currentRes.status &&
    additions === 0 &&
    deletions === 0 &&
    headerDiffs.every((h) => h.type === "unchanged");

  const summary: ResponseDiffSummary = {
    statusDiff:
      baselineRes.status !== currentRes.status
        ? {
            oldStatus: baselineRes.status,
            newStatus: currentRes.status,
            oldStatusText: baselineRes.status_text,
            newStatusText: currentRes.status_text,
          }
        : undefined,
    sizeDiff: {
      oldBytes: baselineRes.size_bytes,
      newBytes: currentRes.size_bytes,
      deltaBytes: currentRes.size_bytes - baselineRes.size_bytes,
    },
    timeDiff: {
      oldMs: baselineRes.time_ms,
      newMs: currentRes.time_ms,
      deltaMs: currentRes.time_ms - baselineRes.time_ms,
    },
    headerDiffs,
    additions,
    deletions,
    unchanged,
  };

  return {
    summary,
    unifiedDiff,
    splitDiff,
    isIdentical,
  };
};

