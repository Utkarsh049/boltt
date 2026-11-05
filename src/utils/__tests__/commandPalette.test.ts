import { describe, it, expect } from "vitest";
import {
  fuzzyMatch,
  highlightMatches,
  parsePaletteQuery,
  extractProjectRequests,
  extractEnvironmentCommands,
  extractThemeCommands,
  extractQuickActionCommands,
  extractNavigationCommands,
  searchCommands,
  CommandItem,
} from "../commandPalette";
import { Project } from "../../store/projectsStore";
import { Environment } from "../../store/envStore";

describe("commandPalette engine", () => {
  describe("fuzzyMatch", () => {
    it("handles exact match with highest score and all indices", () => {
      const res = fuzzyMatch("Send Request", "Send Request");
      expect(res.matches).toBe(true);
      expect(res.score).toBe(1000);
      expect(res.matchedIndices.length).toBe("Send Request".length);
    });

    it("handles case-insensitive prefix match", () => {
      const res = fuzzyMatch("send", "Send Active Request");
      expect(res.matches).toBe(true);
      expect(res.score).toBeGreaterThan(400);
      expect(res.matchedIndices).toEqual([0, 1, 2, 3]);
    });

    it("handles substring match", () => {
      const res = fuzzyMatch("user", "Get User Profile");
      expect(res.matches).toBe(true);
      expect(res.matchedIndices).toEqual([4, 5, 6, 7]);
    });

    it("handles fuzzy subsequence match (e.g. 'gusr' -> 'Get Users')", () => {
      const res = fuzzyMatch("gusr", "Get Users");
      expect(res.matches).toBe(true);
      expect(res.score).toBeGreaterThan(0);
      expect(res.matchedIndices).toEqual([0, 4, 5, 7]);
    });

    it("returns matches: false for non-matching pattern", () => {
      const res = fuzzyMatch("banana", "Get Users");
      expect(res.matches).toBe(false);
      expect(res.score).toBe(0);
      expect(res.matchedIndices).toEqual([]);
    });

    it("handles empty pattern or target gracefully", () => {
      expect(fuzzyMatch("", "Anything").matches).toBe(true);
      expect(fuzzyMatch("test", "").matches).toBe(false);
    });
  });

  describe("highlightMatches", () => {
    it("returns single non-match segment when no indices match", () => {
      const segments = highlightMatches("Hello World", []);
      expect(segments).toEqual([{ text: "Hello World", isMatch: false }]);
    });

    it("splits text into matching and non-matching segments", () => {
      // indices: 0, 1, 2, 3 for "Send"
      const segments = highlightMatches("Send Request", [0, 1, 2, 3]);
      expect(segments).toEqual([
        { text: "Send", isMatch: true },
        { text: " Request", isMatch: false },
      ]);
    });

    it("handles interleaved matches", () => {
      // 'H' (0) and 'W' (6) in "Hello World"
      const segments = highlightMatches("Hello World", [0, 6]);
      expect(segments).toEqual([
        { text: "H", isMatch: true },
        { text: "ello ", isMatch: false },
        { text: "W", isMatch: true },
        { text: "orld", isMatch: false },
      ]);
    });
  });

  describe("parsePaletteQuery", () => {
    it("detects > prefix as action filter", () => {
      expect(parsePaletteQuery("> send")).toEqual({
        filterCategory: "action",
        query: "send",
      });
      expect(parsePaletteQuery(">")).toEqual({
        filterCategory: "action",
        query: "",
      });
    });

    it("detects action: prefix", () => {
      expect(parsePaletteQuery("action: curl")).toEqual({
        filterCategory: "action",
        query: "curl",
      });
    });

    it("detects req: and request: prefix", () => {
      expect(parsePaletteQuery("req: login")).toEqual({
        filterCategory: "request",
        query: "login",
      });
      expect(parsePaletteQuery("request: signup")).toEqual({
        filterCategory: "request",
        query: "signup",
      });
    });

    it("detects env: and environment: prefix", () => {
      expect(parsePaletteQuery("env: staging")).toEqual({
        filterCategory: "environment",
        query: "staging",
      });
      expect(parsePaletteQuery("environment: production")).toEqual({
        filterCategory: "environment",
        query: "production",
      });
    });

    it("detects theme: prefix", () => {
      expect(parsePaletteQuery("theme: dracula")).toEqual({
        filterCategory: "theme",
        query: "dracula",
      });
    });

    it("detects nav: and tab: prefix", () => {
      expect(parsePaletteQuery("nav: history")).toEqual({
        filterCategory: "navigation",
        query: "history",
      });
    });

    it("returns plain query when no prefix is given", () => {
      expect(parsePaletteQuery("get user")).toEqual({
        query: "get user",
      });
    });
  });

  describe("extractProjectRequests", () => {
    it("recursively flattens nested folder requests with breadcrumbs", () => {
      const mockProjects: Project[] = [
        {
          id: "proj-1",
          name: "Acme API",
          folders: [
            {
              id: "f-1",
              name: "Auth",
              requests: [
                {
                  id: "req-1",
                  name: "Login User",
                  method: "POST",
                  url: "https://api.acme.com/auth/login",
                  headers: [],
                  params: [],
                  body: { type: "None" },
                  auth: { type: "None" },
                },
              ],
              subfolders: [
                {
                  id: "f-2",
                  name: "OAuth",
                  requests: [
                    {
                      id: "req-2",
                      name: "Callback",
                      method: "GET",
                      url: "https://api.acme.com/auth/callback",
                      headers: [],
                      params: [],
                      body: { type: "None" },
                      auth: { type: "None" },
                    },
                  ],
                  subfolders: [],
                },
              ],
            },
          ],
        },
      ];

      const commands = extractProjectRequests(mockProjects);
      expect(commands.length).toBe(2);

      expect(commands[0].title).toBe("Login User");
      expect(commands[0].subtitle).toBe("Acme API / Auth");
      expect(commands[0].badge).toBe("POST");

      expect(commands[1].title).toBe("Callback");
      expect(commands[1].subtitle).toBe("Acme API / Auth / OAuth");
      expect(commands[1].badge).toBe("GET");
    });
  });

  describe("extractEnvironmentCommands", () => {
    it("includes No Environment option and marks active environment", () => {
      const mockEnvironments: Environment[] = [
        {
          id: "production:1",
          name: "Production Cloud",
          variables: [{ key: "API_KEY", value: "secret", enabled: true }],
        },
        {
          id: "staging:2",
          name: "Staging Cluster",
          variables: [],
        },
      ];

      const commands = extractEnvironmentCommands(mockEnvironments, "production:1");
      expect(commands.length).toBe(3); // No Environment + 2 envs

      expect(commands[0].title).toBe("No Environment");
      expect(commands[0].badge).toBeUndefined();

      expect(commands[1].title).toBe("Production Cloud");
      expect(commands[1].badge).toBe("Active");

      expect(commands[2].title).toBe("Staging Cluster");
      expect(commands[2].badge).toBeUndefined();
    });
  });

  describe("extractThemeCommands", () => {
    it("returns all themes and marks active theme", () => {
      const commands = extractThemeCommands("nord");
      expect(commands.length).toBe(6);
      const nord = commands.find((c) => c.id === "theme-nord");
      expect(nord?.badge).toBe("Active");

      const dark = commands.find((c) => c.id === "theme-dark");
      expect(dark?.badge).toBeUndefined();
    });
  });

  describe("extractQuickActionCommands", () => {
    it("generates core actions and reflects SSL verification state", () => {
      const actionsStrict = extractQuickActionCommands({
        hasActiveRequest: true,
        hasResponse: true,
        sslVerify: true,
      });

      const sslStrict = actionsStrict.find((a) => a.actionId === "toggle_ssl");
      expect(sslStrict?.title).toBe("Disable SSL Verification");
      expect(sslStrict?.badge).toBe("Strict TLS");

      const actionsInsecure = extractQuickActionCommands({
        hasActiveRequest: true,
        hasResponse: true,
        sslVerify: false,
      });

      const sslInsecure = actionsInsecure.find((a) => a.actionId === "toggle_ssl");
      expect(sslInsecure?.title).toBe("Enable SSL Verification");
      expect(sslInsecure?.badge).toBe("Insecure TLS");
    });
  });

  describe("extractNavigationCommands", () => {
    it("generates navigation items for sidebar tabs", () => {
      const navItems = extractNavigationCommands();
      expect(navItems.length).toBe(3);
      expect(navItems.map((n) => n.actionId)).toEqual([
        "nav_workspace",
        "nav_environments",
        "nav_history",
      ]);
    });
  });

  describe("searchCommands", () => {
    const sampleItems: CommandItem[] = [
      {
        id: "1",
        title: "Send Active Request",
        category: "action",
        keywords: ["send", "run", "dispatch"],
      },
      {
        id: "2",
        title: "Get User List",
        category: "request",
        badge: "GET",
        keywords: ["users", "list"],
      },
      {
        id: "3",
        title: "Post User Signup",
        category: "request",
        badge: "POST",
        keywords: ["users", "auth"],
      },
      {
        id: "4",
        title: "Staging Environment",
        category: "environment",
        keywords: ["staging", "env"],
      },
    ];

    it("returns pool items when query is empty", () => {
      const results = searchCommands(sampleItems, "");
      expect(results.length).toBe(4);
    });

    it("filters by category when prefix is provided", () => {
      const actionResults = searchCommands(sampleItems, "> send");
      expect(actionResults.length).toBe(1);
      expect(actionResults[0].item.id).toBe("1");

      const reqResults = searchCommands(sampleItems, "req: user");
      expect(reqResults.length).toBe(2);
      expect(reqResults.every((r) => r.item.category === "request")).toBe(true);
    });

    it("ranks exact/prefix title matches higher than keyword matches", () => {
      const results = searchCommands(sampleItems, "send");
      expect(results[0].item.title).toBe("Send Active Request");
    });

    it("respects max limit parameter", () => {
      const results = searchCommands(sampleItems, "", 2);
      expect(results.length).toBe(2);
    });
  });
});
