export interface Variable {
  name: string;
  value: string;
  enabled: boolean;
  isFromConfig?: boolean;
}

export interface VariableDefinition {
  name: string;
  varType: string;
  defaultValue?: string;
}

export interface HeaderDefinition {
  name: string;
  defaultValue?: string;
}

export interface ConfigHeader {
  name: string;
  value: string;
  enabled: boolean;
  isFromConfig: boolean;
}

const HEADERS_STORAGE_KEY = 'reqcraft_config_headers';

/**
 * Load config headers from localStorage
 */
export function loadConfigHeaders(): ConfigHeader[] {
  try {
    const stored = localStorage.getItem(HEADERS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load config headers:', e);
  }
  return [];
}

/**
 * Save config headers to localStorage
 */
export function saveConfigHeaders(headers: ConfigHeader[]): void {
  try {
    localStorage.setItem(HEADERS_STORAGE_KEY, JSON.stringify(headers));
  } catch (e) {
    console.error('Failed to save config headers:', e);
  }
}

/**
 * Merge config headers with saved headers
 */
export function mergeConfigHeaders(
  configHeaders: HeaderDefinition[],
  savedHeaders: ConfigHeader[]
): ConfigHeader[] {
  const result: ConfigHeader[] = [];
  const savedMap = new Map(savedHeaders.filter((h) => h.name).map((h) => [h.name, h]));

  for (const configHeader of configHeaders) {
    const saved = savedMap.get(configHeader.name);
    if (saved) {
      result.push({
        ...saved,
        isFromConfig: true,
      });
    } else {
      result.push({
        name: configHeader.name,
        value: configHeader.defaultValue || '',
        enabled: true,
        isFromConfig: true,
      });
    }
  }

  return result;
}

const VARIABLE_REGEX = /\{(\w+)\}/g;

/**
 * Replace variables in a string with their values
 * Variables are in the format {variableName}
 */
export function replaceVariables(text: string, variables: Variable[]): string {
  if (!text) return text;

  return text.replace(VARIABLE_REGEX, (match, varName) => {
    const variable = variables.find((v) => v.name === varName && v.enabled);
    return variable ? variable.value : match;
  });
}

/**
 * Replace variables in a key-value array
 */
export function replaceVariablesInKeyValues(
  items: { key: string; value: string; enabled: boolean }[],
  variables: Variable[]
): { key: string; value: string; enabled: boolean }[] {
  return items.map((item) => ({
    ...item,
    key: replaceVariables(item.key, variables),
    value: replaceVariables(item.value, variables),
  }));
}

/**
 * Extract variable names from a string
 */
export function extractVariableNames(text: string): string[] {
  if (!text) return [];

  const matches = text.matchAll(VARIABLE_REGEX);
  return [...new Set([...matches].map((m) => m[1]))];
}

/**
 * Check if a string contains variables
 */
export function hasVariables(text: string): boolean {
  return VARIABLE_REGEX.test(text);
}

/**
 * Get all unique variable names from request state
 */
export function getAllVariableNames(
  url: string,
  params: { key: string; value: string }[],
  headers: { key: string; value: string }[],
  body: string
): string[] {
  const names = new Set<string>();

  extractVariableNames(url).forEach((n) => names.add(n));
  params.forEach((p) => {
    extractVariableNames(p.key).forEach((n) => names.add(n));
    extractVariableNames(p.value).forEach((n) => names.add(n));
  });
  headers.forEach((h) => {
    extractVariableNames(h.key).forEach((n) => names.add(n));
    extractVariableNames(h.value).forEach((n) => names.add(n));
  });
  extractVariableNames(body).forEach((n) => names.add(n));

  return [...names];
}

const VARIABLES_STORAGE_KEY = 'reqcraft_variables';

/**
 * Load variables from localStorage
 */
export function loadVariables(): Variable[] {
  try {
    const stored = localStorage.getItem(VARIABLES_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load variables:', e);
  }
  return [{ name: '', value: '', enabled: true }];
}

/**
 * Save variables to localStorage (only saves user-defined variables)
 */
export function saveVariables(variables: Variable[]): void {
  try {
    // Only save user-defined variables (not from config)
    const userVariables = variables.filter((v) => !v.isFromConfig);
    localStorage.setItem(VARIABLES_STORAGE_KEY, JSON.stringify(userVariables));
  } catch (e) {
    console.error('Failed to save variables:', e);
  }
}

/**
 * Merge config variables with user variables
 * Config variables take precedence for defaults but user can override values
 */
export function mergeVariables(
  configVars: VariableDefinition[],
  userVars: Variable[]
): Variable[] {
  const result: Variable[] = [];
  const userVarMap = new Map(userVars.filter((v) => v.name).map((v) => [v.name, v]));

  // Add config variables first
  for (const configVar of configVars) {
    const userVar = userVarMap.get(configVar.name);
    if (userVar) {
      // User has overridden this variable
      result.push({
        ...userVar,
        isFromConfig: true,
      });
      userVarMap.delete(configVar.name);
    } else {
      // Use config default
      result.push({
        name: configVar.name,
        value: configVar.defaultValue || '',
        enabled: true,
        isFromConfig: true,
      });
    }
  }

  // Add remaining user variables
  for (const userVar of userVarMap.values()) {
    result.push(userVar);
  }

  // Add empty row for new input
  if (result.length === 0 || result[result.length - 1].name !== '') {
    result.push({ name: '', value: '', enabled: true });
  }

  return result;
}
