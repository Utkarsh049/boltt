import { Project, Folder } from "../store/projectsStore";
import { Environment } from "../store/envStore";

export type CommandCategory = "request" | "action" | "environment" | "theme" | "navigation";

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: CommandCategory;
  keywords?: string[];
  shortcut?: string;
  badge?: string;
  badgeColor?: string;
  icon?: string;
  data?: any;
  actionId?: string;
}

export interface MatchResult {
  matches: boolean;
  score: number;
  matchedIndices: number[];
}

export interface ScoredCommandItem {
  item: CommandItem;
  score: number;
  titleMatches: number[];
  subtitleMatches?: number[];
}

export interface HighlightSegment {
  text: string;
  isMatch: boolean;
}

export const getMethodColor = (method: string): string => {
  switch (method.toUpperCase()) {
    case "GET":
      return "text-[#4ade80]";
    case "POST":
      return "text-[#fb923c]";
    case "PUT":
      return "text-[#60a5fa]";
    case "PATCH":
      return "text-[#c084fc]";
    case "DELETE":
      return "text-[#f87171]";
    default:
      return "text-[#8b919d]";
  }
};

/**
 * Fuzzy matches pattern against a target string.
 * Returns match status, scoring, and indices of matched characters in target.
 */
export function fuzzyMatch(pattern: string, target: string): MatchResult {
  if (!pattern) {
    return { matches: true, score: 0, matchedIndices: [] };
  }
  if (!target) {
    return { matches: false, score: 0, matchedIndices: [] };
  }

  const pLower = pattern.toLowerCase();
  const tLower = target.toLowerCase();

  // 1. Exact match
  if (tLower === pLower) {
    const indices = Array.from({ length: target.length }, (_, i) => i);
    return { matches: true, score: 1000, matchedIndices: indices };
  }

  // 2. Starts with pattern (prefix match)
  if (tLower.startsWith(pLower)) {
    const indices = Array.from({ length: pLower.length }, (_, i) => i);
    return { matches: true, score: 500 + Math.max(0, 50 - target.length), matchedIndices: indices };
  }

  // 3. Substring match
  const subIdx = tLower.indexOf(pLower);
  if (subIdx !== -1) {
    const indices = Array.from({ length: pLower.length }, (_, i) => subIdx + i);
    const isWordBoundary = subIdx === 0 || /[\s/._-]/.test(target[subIdx - 1]);
    const score = isWordBoundary ? 350 : 250;
    return { matches: true, score, matchedIndices: indices };
  }

  // 4. Sequential fuzzy subsequence matching
  let pIdx = 0;
  let tIdx = 0;
  const matchedIndices: number[] = [];
  let score = 0;
  let consecutiveMatches = 0;

  while (pIdx < pLower.length && tIdx < tLower.length) {
    if (pLower[pIdx] === tLower[tIdx]) {
      matchedIndices.push(tIdx);

      const isWordBoundary = tIdx === 0 || /[\s/._-]/.test(target[tIdx - 1]);
      if (isWordBoundary) {
        score += 30;
      }

      if (
        tIdx > 0 &&
        target[tIdx] >= "A" &&
        target[tIdx] <= "Z" &&
        target[tIdx - 1] >= "a" &&
        target[tIdx - 1] <= "z"
      ) {
        score += 25;
      }

      if (consecutiveMatches > 0) {
        score += consecutiveMatches * 10;
      }
      consecutiveMatches++;
      score += 10;
      pIdx++;
    } else {
      consecutiveMatches = 0;
    }
    tIdx++;
  }

  if (pIdx === pLower.length) {
    const span = matchedIndices[matchedIndices.length - 1] - matchedIndices[0] + 1;
    score -= (span - pattern.length) * 2;
    return { matches: true, score: Math.max(1, score), matchedIndices };
  }

  return { matches: false, score: 0, matchedIndices: [] };
}

/**
 * Splits text into segments marked with isMatch for visual highlighting.
 */
export function highlightMatches(text: string, indices: number[]): HighlightSegment[] {
  if (!indices || indices.length === 0 || !text) {
    return [{ text, isMatch: false }];
  }

  const indexSet = new Set(indices);
  const segments: HighlightSegment[] = [];
  let currentSegment = "";
  let currentIsMatch = indexSet.has(0);

  for (let i = 0; i < text.length; i++) {
    const isMatch = indexSet.has(i);
    if (isMatch === currentIsMatch) {
      currentSegment += text[i];
    } else {
      if (currentSegment) {
        segments.push({ text: currentSegment, isMatch: currentIsMatch });
      }
      currentSegment = text[i];
      currentIsMatch = isMatch;
    }
  }

  if (currentSegment) {
    segments.push({ text: currentSegment, isMatch: currentIsMatch });
  }

  return segments;
}

/**
 * Parses user input for prefix category filters (e.g. "> send", "theme: dracula", "req: users").
 */
export function parsePaletteQuery(rawQuery: string): {
  filterCategory?: CommandCategory;
  query: string;
} {
  const trimmed = rawQuery.trim();

  // Action prefix: > or action:
  if (trimmed.startsWith(">")) {
    return { filterCategory: "action", query: trimmed.slice(1).trim() };
  }
  if (/^action:\s*/i.test(trimmed)) {
    return { filterCategory: "action", query: trimmed.replace(/^action:\s*/i, "").trim() };
  }

  // Request prefix: req: or request:
  if (/^(req|request):\s*/i.test(trimmed)) {
    return { filterCategory: "request", query: trimmed.replace(/^(req|request):\s*/i, "").trim() };
  }

  // Environment prefix: env: or environment:
  if (/^(env|environment):\s*/i.test(trimmed)) {
    return { filterCategory: "environment", query: trimmed.replace(/^(env|environment):\s*/i, "").trim() };
  }

  // Theme prefix: theme:
  if (/^theme:\s*/i.test(trimmed)) {
    return { filterCategory: "theme", query: trimmed.replace(/^theme:\s*/i, "").trim() };
  }

  // Navigation prefix: nav: or tab:
  if (/^(nav|tab):\s*/i.test(trimmed)) {
    return { filterCategory: "navigation", query: trimmed.replace(/^(nav|tab):\s*/i, "").trim() };
  }

  return { query: trimmed };
}

/**
 * Extracts and flattens all requests from mounted projects into CommandItems.
 */
export function extractProjectRequests(projects: Project[]): CommandItem[] {
  const items: CommandItem[] = [];

  const traverseFolder = (
    folder: Folder,
    projectId: string,
    breadcrumbs: string[]
  ) => {
    const currentBreadcrumbs = [...breadcrumbs, folder.name];

    if (Array.isArray(folder.requests)) {
      for (const req of folder.requests) {
        items.push({
          id: `req-${projectId}-${req.id}`,
          title: req.name || req.url,
          subtitle: currentBreadcrumbs.join(" / "),
          category: "request",
          badge: req.method,
          badgeColor: getMethodColor(req.method),
          keywords: [req.url, req.method, ...currentBreadcrumbs],
          data: { request: req, projectId },
        });
      }
    }

    if (Array.isArray(folder.subfolders)) {
      for (const sub of folder.subfolders) {
        traverseFolder(sub, projectId, currentBreadcrumbs);
      }
    }
  };

  for (const project of projects) {
    if (Array.isArray(project.folders)) {
      for (const folder of project.folders) {
        traverseFolder(folder, project.id, [project.name]);
      }
    }
  }

  return items;
}

/**
 * Builds environment switching command items.
 */
export function extractEnvironmentCommands(
  environments: Environment[],
  activeEnvironmentId: string | null
): CommandItem[] {
  const items: CommandItem[] = [
    {
      id: "env-none",
      title: "No Environment",
      subtitle: "Clear active environment variables",
      category: "environment",
      badge: activeEnvironmentId === null ? "Active" : undefined,
      badgeColor: "text-emerald-400",
      keywords: ["none", "clear", "unset", "environment"],
      data: { environmentId: null },
    },
  ];

  for (const env of environments) {
    const isActive = env.id === activeEnvironmentId;
    const varCount = env.variables ? env.variables.length : 0;
    const group = env.id.includes(":") ? env.id.split(":")[0] : "custom";
    items.push({
      id: `env-${env.id}`,
      title: env.name,
      subtitle: `${varCount} variable${varCount === 1 ? "" : "s"} (${group})`,
      category: "environment",
      badge: isActive ? "Active" : undefined,
      badgeColor: "text-emerald-400",
      keywords: [env.name, "environment", "env", ...(env.variables ? env.variables.map((v) => v.key) : [])],
      data: { environmentId: env.id },
    });
  }

  return items;
}

export const AVAILABLE_THEMES = [
  { id: "dark", name: "Dark Theme", desc: "Default dark studio palette" },
  { id: "light", name: "Light Theme", desc: "Clean bright paper contrast" },
  { id: "nord", name: "Nord Theme", desc: "Arctic cool blue aesthetic" },
  { id: "dracula", name: "Dracula Theme", desc: "Vibrant high-contrast gothic dark" },
  { id: "space", name: "Space Theme", desc: "Deep cosmic midnight blue" },
  { id: "glass", name: "Glass Theme", desc: "Translucent backdrop blur style" },
];

/**
 * Builds theme switching command items.
 */
export function extractThemeCommands(currentTheme: string): CommandItem[] {
  return AVAILABLE_THEMES.map((t) => ({
    id: `theme-${t.id}`,
    title: t.name,
    subtitle: t.desc,
    category: "theme",
    badge: currentTheme === t.id ? "Active" : undefined,
    badgeColor: "text-emerald-400",
    keywords: [t.id, t.name, "theme", "color", "appearance"],
    data: { themeId: t.id },
  }));
}

export interface QuickActionContext {
  hasActiveRequest: boolean;
  hasResponse: boolean;
  sslVerify: boolean;
}

/**
 * Builds global quick action commands.
 */
export function extractQuickActionCommands(context: QuickActionContext): CommandItem[] {
  return [
    {
      id: "action-send-request",
      title: "Send Active Request",
      subtitle: "Dispatch current HTTP request to remote endpoint",
      category: "action",
      shortcut: "Ctrl+Enter",
      keywords: ["send", "execute", "run", "request", "dispatch"],
      actionId: "send_request",
    },
    {
      id: "action-new-tab",
      title: "New Request Tab",
      subtitle: "Open a blank HTTP request draft",
      category: "action",
      shortcut: "Ctrl+T",
      keywords: ["new", "tab", "create", "request", "draft"],
      actionId: "new_tab",
    },
    {
      id: "action-close-tab",
      title: "Close Current Tab",
      subtitle: "Close active editor tab",
      category: "action",
      shortcut: "Ctrl+W",
      keywords: ["close", "tab", "discard"],
      actionId: "close_tab",
    },
    {
      id: "action-save-request",
      title: "Save Request",
      subtitle: "Save current request to project folder",
      category: "action",
      shortcut: "Ctrl+S",
      keywords: ["save", "project", "collection"],
      actionId: "save_request",
    },
    {
      id: "action-import-curl",
      title: "Import / Paste cURL",
      subtitle: "Parse cURL from clipboard into request builder",
      category: "action",
      keywords: ["curl", "import", "paste", "bash", "shell"],
      actionId: "import_curl",
    },
    {
      id: "action-copy-curl",
      title: "Copy as cURL",
      subtitle: "Export current request as POSIX cURL command",
      category: "action",
      keywords: ["curl", "copy", "export", "cli"],
      actionId: "copy_curl",
    },
    {
      id: "action-toggle-ssl",
      title: context.sslVerify ? "Disable SSL Verification" : "Enable SSL Verification",
      subtitle: context.sslVerify
        ? "Allow insecure self-signed certificates"
        : "Enforce strict TLS certificate checks",
      category: "action",
      badge: context.sslVerify ? "Strict TLS" : "Insecure TLS",
      badgeColor: context.sslVerify ? "text-emerald-400" : "text-amber-400",
      keywords: ["ssl", "tls", "certificate", "insecure", "verify"],
      actionId: "toggle_ssl",
    },
    {
      id: "action-open-diff",
      title: "Compare Response (Diff)",
      subtitle: "Side-by-side comparison against previous run or tab",
      category: "action",
      keywords: ["diff", "compare", "side by side", "history", "drift"],
      actionId: "open_diff",
    },
    {
      id: "action-clear-history",
      title: "Clear Request History",
      subtitle: "Erase recorded request dispatch history",
      category: "action",
      keywords: ["history", "clear", "delete", "recent"],
      actionId: "clear_history",
    },
    {
      id: "action-manage-environments",
      title: "Manage Environments",
      subtitle: "Open environment and variable manager",
      category: "action",
      keywords: ["environment", "variables", "secrets", "env"],
      actionId: "manage_environments",
    },
  ];
}

/**
 * Builds navigation commands (sidebar switcher).
 */
export function extractNavigationCommands(): CommandItem[] {
  return [
    {
      id: "nav-workspace",
      title: "Go to Workspace Sidebar",
      subtitle: "Collections and project files tree",
      category: "navigation",
      keywords: ["workspace", "projects", "collections", "tree", "sidebar"],
      actionId: "nav_workspace",
    },
    {
      id: "nav-environments",
      title: "Go to Environments Sidebar",
      subtitle: "Environment variables editor panel",
      category: "navigation",
      keywords: ["environments", "variables", "sidebar"],
      actionId: "nav_environments",
    },
    {
      id: "nav-history",
      title: "Go to History Sidebar",
      subtitle: "Recent request executions timeline",
      category: "navigation",
      keywords: ["history", "recent", "timeline", "sidebar"],
      actionId: "nav_history",
    },
  ];
}

/**
 * Searches and scores commands against a query string.
 */
export function searchCommands(
  items: CommandItem[],
  rawQuery: string,
  limit: number = 60
): ScoredCommandItem[] {
  const { filterCategory, query } = parsePaletteQuery(rawQuery);

  const pool = filterCategory
    ? items.filter((item) => item.category === filterCategory)
    : items;

  if (!query) {
    return pool.slice(0, limit).map((item) => ({
      item,
      score: 1,
      titleMatches: [],
    }));
  }

  const scored: ScoredCommandItem[] = [];

  for (const item of pool) {
    const titleMatch = fuzzyMatch(query, item.title);

    let subtitleMatch: MatchResult = { matches: false, score: 0, matchedIndices: [] };
    if (item.subtitle) {
      subtitleMatch = fuzzyMatch(query, item.subtitle);
    }

    let keywordScore = 0;
    if (item.keywords && item.keywords.length > 0) {
      for (const kw of item.keywords) {
        const km = fuzzyMatch(query, kw);
        if (km.matches && km.score > keywordScore) {
          keywordScore = km.score;
        }
      }
    }

    let badgeScore = 0;
    if (item.badge) {
      const bm = fuzzyMatch(query, item.badge);
      if (bm.matches) {
        badgeScore = bm.score;
      }
    }

    const matches =
      titleMatch.matches || subtitleMatch.matches || keywordScore > 0 || badgeScore > 0;

    if (matches) {
      const totalScore =
        (titleMatch.matches ? titleMatch.score * 2 : 0) +
        (subtitleMatch.matches ? subtitleMatch.score * 0.7 : 0) +
        keywordScore * 0.5 +
        badgeScore * 1.2;

      scored.push({
        item,
        score: totalScore,
        titleMatches: titleMatch.matches ? titleMatch.matchedIndices : [],
        subtitleMatches: subtitleMatch.matches ? subtitleMatch.matchedIndices : [],
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

