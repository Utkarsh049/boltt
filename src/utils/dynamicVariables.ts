import { CompletionContext, CompletionResult, CompletionSource } from "@codemirror/autocomplete";

export interface DynamicVariableDefinition {
  name: string;
  label: string;
  description: string;
  category: "Identifier" | "Date & Time" | "Random & Mock";
  example: string;
  generate: () => string;
}

export const DYNAMIC_VARIABLES: DynamicVariableDefinition[] = [
  {
    name: "$uuid",
    label: "{{$uuid}}",
    description: "Cryptographically random UUID v4",
    category: "Identifier",
    example: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    generate: () => crypto.randomUUID(),
  },
  {
    name: "$guid",
    label: "{{$guid}}",
    description: "Alias for $uuid (random UUID v4)",
    category: "Identifier",
    example: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    generate: () => crypto.randomUUID(),
  },
  {
    name: "$timestamp",
    label: "{{$timestamp}}",
    description: "Current Unix epoch timestamp in seconds",
    category: "Date & Time",
    example: "1730000000",
    generate: () => Math.floor(Date.now() / 1000).toString(),
  },
  {
    name: "$timestampMs",
    label: "{{$timestampMs}}",
    description: "Current Unix epoch timestamp in milliseconds",
    category: "Date & Time",
    example: "1730000000000",
    generate: () => Date.now().toString(),
  },
  {
    name: "$isoTimestamp",
    label: "{{$isoTimestamp}}",
    description: "Current ISO-8601 UTC timestamp",
    category: "Date & Time",
    example: "2026-11-04T18:00:00.000Z",
    generate: () => new Date().toISOString(),
  },
  {
    name: "$randomInt",
    label: "{{$randomInt}}",
    description: "Random integer between 1 and 1000",
    category: "Random & Mock",
    example: "542",
    generate: () => Math.floor(Math.random() * 1000 + 1).toString(),
  },
  {
    name: "$randomEmail",
    label: "{{$randomEmail}}",
    description: "Realistic test email address",
    category: "Random & Mock",
    example: "test.user48201@example.com",
    generate: () => `test.user${Math.floor(Math.random() * 90000 + 10000)}@example.com`,
  },
  {
    name: "$randomAlphaNumeric",
    label: "{{$randomAlphaNumeric}}",
    description: "Random 10-character alphanumeric string",
    category: "Random & Mock",
    example: "a7c29e1f40",
    generate: () => crypto.randomUUID().replace(/-/g, "").substring(0, 10),
  },
];

/**
 * Evaluates a single dynamic variable by name (e.g. "$uuid" or "{{$uuid}}").
 * Returns the generated string value, or null if unrecognized.
 */
export const evaluateDynamicVariable = (varName: string): string | null => {
  const clean = varName.trim().replace(/^\{\{|\}\}$/g, "").trim();
  const found = DYNAMIC_VARIABLES.find((v) => v.name === clean);
  return found ? found.generate() : null;
};

/**
 * Replaces all `{{variable}}` occurrences in input.
 * User environment variables take precedence over dynamic variable generators.
 * Unmatched tokens remain intact.
 */
export const substituteClientVariables = (
  input: string,
  envVars: Record<string, string> = {}
): string => {
  return input.replace(/\{\{\s*([\w$.]+)\s*\}\}/g, (match, varName) => {
    if (Object.prototype.hasOwnProperty.call(envVars, varName)) {
      return envVars[varName];
    }
    const dynamicVal = evaluateDynamicVariable(varName);
    if (dynamicVal !== null) {
      return dynamicVal;
    }
    return match;
  });
};

/**
 * CodeMirror completion source for `{{` variable interpolation.
 * Autocompletes both active environment variables (with masked secrets) and built-in dynamic variables.
 */
export const createVariableCompletionSource = (
  getEnvVars: () => Record<string, string>,
  getSecretKeys?: () => Set<string>
): CompletionSource => {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/\{\{[\w$.]*/);
    if (!word) return null;

    const envVars = getEnvVars();
    const secretKeys = getSecretKeys ? getSecretKeys() : new Set<string>();

    const options = [
      ...DYNAMIC_VARIABLES.map((v) => ({
        label: v.label,
        detail: v.description,
        info: `${v.category} • Example: ${v.example}`,
        type: "keyword",
        apply: v.label,
        boost: 2,
      })),
      ...Object.entries(envVars).map(([key, val]) => {
        const isSecret = secretKeys.has(key);
        return {
          label: `{{${key}}}`,
          detail: isSecret
            ? "•••••••• (secret)"
            : val
            ? val.length > 25
              ? `${val.substring(0, 25)}...`
              : val
            : "(empty)",
          info: isSecret
            ? `Secret Variable: {{${key}}} (value masked)`
            : `Environment Variable: ${key} = "${val}"`,
          type: isSecret ? "constant" : "variable",
          apply: `{{${key}}}`,
          boost: 1,
        };
      }),
    ];

    return {
      from: word.from,
      options,
      filter: true,
    };
  };
};

