import { 
  JsonValue, 
  JsonObject, 
  JsonArray, 
  JsonTransformOptions,
  JsonTransformRule,
  JsonPath 
} from './types/json.types';
import { jsonPath } from './json.path';
import { parseJson, stringifyJson } from './json.parser';

export class JsonTransformError extends Error {
  constructor(
    message: string,
    public path?: string,
    public value?: any
  ) {
    super(message);
    this.name = 'JsonTransformError';
  }
}

/**
 * Transform JSON according to transformation rules
 */
export function transformJson<T = JsonValue>(
  json: JsonValue,
  options: JsonTransformOptions
): T {
  const {
    rules = [],
    mapFunction,
    filterFunction,
    defaultValue,
    deep = true,
    inPlace = false
  } = options;

  let result = inPlace ? json : parseJson(stringifyJson(json));

  // Apply mapping function if provided
  if (mapFunction) {
    result = applyMapFunction(result, mapFunction, deep);
  }

  // Apply filter function if provided
  if (filterFunction) {
    result = applyFilterFunction(result, filterFunction, deep);
  }

  // Apply transformation rules
  if (rules.length > 0) {
    result = applyTransformationRules(result, rules, deep);
  }

  // Handle empty results
  if (result === undefined && defaultValue !== undefined) {
    return defaultValue as T;
  }

  return result as T;
}

/**
 * Map over JSON values
 */
export function mapJson(
  json: JsonArray,
  callback: (item: JsonValue, index: number) => JsonValue
): JsonArray {
  if (!Array.isArray(json)) {
    throw new JsonTransformError('Input must be an array', undefined, json);
  }

  return json.map((item, index) => {
    try {
      return callback(item, index);
    } catch (error: any) {
      throw new JsonTransformError(
        `Error in map callback at index ${index}: ${error.message}`,
        `[${index}]`,
        item
      );
    }
  });
}

/**
 * Filter JSON values
 */
export function filterJson(
  json: JsonArray,
  predicate: (item: JsonValue, index: number) => boolean
): JsonArray {
  if (!Array.isArray(json)) {
    throw new JsonTransformError('Input must be an array', undefined, json);
  }

  return json.filter((item, index) => {
    try {
      return predicate(item, index);
    } catch (error: any) {
      throw new JsonTransformError(
        `Error in filter predicate at index ${index}: ${error.message}`,
        `[${index}]`,
        item
      );
    }
  });
}

/**
 * Reduce JSON array
 */
export function reduceJson<T = JsonValue>(
  json: JsonArray,
  reducer: (accumulator: T, current: JsonValue, index: number) => T,
  initialValue: T
): T {
  if (!Array.isArray(json)) {
    throw new JsonTransformError('Input must be an array', undefined, json);
  }

  return json.reduce((acc, current, index) => {
    try {
      return reducer(acc, current, index);
    } catch (error: any) {
      throw new JsonTransformError(
        `Error in reducer at index ${index}: ${error.message}`,
        `[${index}]`,
        current
      );
    }
  }, initialValue);
}

/**
 * Flatten nested JSON object
 */
export function flattenJson(
  json: JsonObject,
  delimiter: string = '.',
  prefix: string = ''
): JsonObject {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new JsonTransformError('Input must be a non-null object', prefix, json);
  }

  const result: JsonObject = {};

  for (const [key, value] of Object.entries(json)) {
    const newKey = prefix ? `${prefix}${delimiter}${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively flatten nested objects
      const flattened = flattenJson(value as JsonObject, delimiter, newKey);
      Object.assign(result, flattened);
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * Unflatten flattened JSON object
 */
export function unflattenJson(
  json: JsonObject,
  delimiter: string = '.'
): JsonObject {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new JsonTransformError('Input must be a non-null object', undefined, json);
  }

  const result: JsonObject = {};

  for (const [key, value] of Object.entries(json)) {
    const keys = key.split(delimiter);
    let current: any = result;

    for (let i = 0; i < keys.length; i++) {
      const part = keys[i];

      if (i === keys.length - 1) {
        // Last part, set the value
        current[part] = value;
      } else {
        // Create nested object if it doesn't exist
        if (!current[part] || typeof current[part] !== 'object') {
          current[part] = {};
        }
        current = current[part];
      }
    }
  }

  return result;
}

/**
 * Rename keys in JSON object
 */
export function renameKeys(
  json: JsonObject,
  keyMap: Record<string, string>
): JsonObject {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new JsonTransformError('Input must be a non-null object', undefined, json);
  }

  const result: JsonObject = {};

  for (const [key, value] of Object.entries(json)) {
    const newKey = keyMap[key] || key;
    result[newKey] = value;
  }

  return result;
}

/**
 * Pick specific keys from JSON object
 */
export function pickKeys(
  json: JsonObject,
  keys: string[]
): JsonObject {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new JsonTransformError('Input must be a non-null object', undefined, json);
  }

  const result: JsonObject = {};

  for (const key of keys) {
    if (key in json) {
      result[key] = json[key];
    }
  }

  return result;
}

/**
 * Omit specific keys from JSON object
 */
export function omitKeys(
  json: JsonObject,
  keys: string[]
): JsonObject {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new JsonTransformError('Input must be a non-null object', undefined, json);
  }

  const result: JsonObject = { ...json };

  for (const key of keys) {
    delete result[key];
  }

  return result;
}

/**
 * Deep clone JSON with transformation
 */
export function deepTransform(
  json: JsonValue,
  transformer: (value: JsonValue, path: string) => JsonValue,
  path: string = ''
): JsonValue {
  // Transform current value
  let transformed = transformer(json, path);

  // Recursively transform nested structures
  if (Array.isArray(transformed)) {
    return transformed.map((item, index) =>
      deepTransform(item, transformer, `${path}[${index}]`)
    );
  } else if (typeof transformed === 'object' && transformed !== null) {
    const result: JsonObject = {};
    for (const [key, value] of Object.entries(transformed)) {
      result[key] = deepTransform(value, transformer, path ? `${path}.${key}` : key);
    }
    return result;
  }

  return transformed;
}

/**
 * Convert JSON values to specific types
 */
export function castValues(
  json: JsonValue,
  typeMap: Record<string, 'string' | 'number' | 'boolean' | 'date'>
): JsonValue {
  if (typeof json !== 'object' || json === null) {
    return json;
  }

  const result = Array.isArray(json) ? [] : {};

  if (Array.isArray(json)) {
    return json.map(item => castValues(item, typeMap));
  }

  for (const [key, value] of Object.entries(json as JsonObject)) {
    const targetType = typeMap[key];
    
    if (targetType) {
      try {
        (result as JsonObject)[key] = castValue(value, targetType);
      } catch {
        (result as JsonObject)[key] = value;
      }
    } else {
      (result as JsonObject)[key] = castValues(value, typeMap);
    }
  }

  return result;
}

/**
 * Sort JSON object by keys
 */
export function sortByKeys(
  json: JsonObject,
  order: 'asc' | 'desc' | ((a: string, b: string) => number) = 'asc'
): JsonObject {
  const entries = Object.entries(json);

  if (typeof order === 'function') {
    entries.sort(([a], [b]) => order(a, b));
  } else {
    entries.sort(([a], [b]) => {
      return order === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
    });
  }

  return Object.fromEntries(entries);
}

/**
 * Group JSON array by key
 */
export function groupBy(
  jsonArray: JsonArray,
  key: string | ((item: JsonValue) => string)
): JsonObject {
  if (!Array.isArray(jsonArray)) {
    throw new JsonTransformError('Input must be an array', undefined, jsonArray);
  }

  return jsonArray.reduce((groups: JsonObject, item) => {
    let groupKey: string;
    
    if (typeof key === 'function') {
      groupKey = key(item);
    } else if (typeof item === 'object' && item !== null) {
      groupKey = String((item as JsonObject)[key] || 'undefined');
    } else {
      groupKey = 'undefined';
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    
    (groups[groupKey] as JsonArray).push(item);
    return groups;
  }, {});
}

// Helper functions
function applyMapFunction(
  json: JsonValue,
  mapFunction: (value: JsonValue, path: string) => JsonValue,
  deep: boolean,
  path: string = ''
): JsonValue {
  const mapped = mapFunction(json, path);

  if (!deep || typeof mapped !== 'object' || mapped === null) {
    return mapped;
  }

  if (Array.isArray(mapped)) {
    return mapped.map((item, index) =>
      applyMapFunction(item, mapFunction, deep, `${path}[${index}]`)
    );
  }

  const result: JsonObject = {};
  for (const [key, value] of Object.entries(mapped)) {
    result[key] = applyMapFunction(value, mapFunction, deep, path ? `${path}.${key}` : key);
  }
  return result;
}

function applyFilterFunction(
  json: JsonValue,
  filterFunction: (value: JsonValue, path: string) => boolean,
  deep: boolean,
  path: string = ''
): JsonValue {
  if (!filterFunction(json, path)) {
    return undefined as any;
  }

  if (!deep || typeof json !== 'object' || json === null) {
    return json;
  }

  if (Array.isArray(json)) {
    return json
      .map((item, index) =>
        applyFilterFunction(item, filterFunction, deep, `${path}[${index}]`)
      )
      .filter(item => item !== undefined);
  }

  const result: JsonObject = {};
  for (const [key, value] of Object.entries(json)) {
    const filtered = applyFilterFunction(value, filterFunction, deep, path ? `${path}.${key}` : key);
    if (filtered !== undefined) {
      result[key] = filtered;
    }
  }
  return result;
}

function applyTransformationRules(
  json: JsonValue,
  rules: JsonTransformRule[],
  deep: boolean
): JsonValue {
  let result = json;

  for (const rule of rules) {
    result = applySingleRule(result, rule, deep);
  }

  return result;
}

function applySingleRule(
  json: JsonValue,
  rule: JsonTransformRule,
  deep: boolean
): JsonValue {
  const { path, operation, value, condition } = rule;

  // Check condition if provided
  if (condition) {
    const shouldApply = evaluateCondition(json, condition);
    if (!shouldApply) {
      return json;
    }
  }

  // Apply operation
  switch (operation) {
    case 'set':
      return jsonPath(json, path, { create: true, value }).target;
    
    case 'delete':
      jsonPath(json, path, { delete: true });
      return json;
    
    case 'rename':
      if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
        const obj = json as JsonObject;
        const oldValue = jsonPath(obj, path).value;
        if (oldValue !== undefined && typeof rule.value === 'string') {
          jsonPath(obj, path, { delete: true });
          jsonPath(obj, rule.value, { create: true, value: oldValue });
        }
      }
      return json;
    
    case 'transform':
      if (typeof rule.value === 'function') {
        const transformResult = jsonPath(json, path);
        if (transformResult.value !== undefined) {
          const transformed = rule.value(transformResult.value, path);
          jsonPath(json, path, { value: transformed });
        }
      }
      return json;
    
    default:
      return json;
  }
}

function evaluateCondition(json: JsonValue, condition: any): boolean {
  if (typeof condition === 'function') {
    return condition(json);
  }
  
  if (typeof condition === 'object' && condition !== null) {
    // Simple condition evaluation (could be extended)
    const { path, operator, value } = condition;
    if (path && operator && value !== undefined) {
      const targetValue = jsonPath(json, path).value;
      return compareValues(targetValue, value, operator);
    }
  }
  
  return true;
}

function compareValues(a: any, b: any, operator: string): boolean {
  switch (operator) {
    case '==': return a == b;
    case '===': return a === b;
    case '!=': return a != b;
    case '!==': return a !== b;
    case '>': return a > b;
    case '>=': return a >= b;
    case '<': return a < b;
    case '<=': return a <= b;
    case 'includes': return String(a).includes(String(b));
    case 'startsWith': return String(a).startsWith(String(b));
    case 'endsWith': return String(a).endsWith(String(b));
    case 'matches': return new RegExp(b).test(String(a));
    default: return false;
  }
}

function castValue(value: any, targetType: string): any {
  if (value === null || value === undefined) {
    return value;
  }

  switch (targetType) {
    case 'string':
      return String(value);
    case 'number':
      const num = Number(value);
      return isNaN(num) ? 0 : num;
    case 'boolean':
      return Boolean(value);
    case 'date':
      const date = new Date(value);
      return isNaN(date.getTime()) ? value : date.toISOString();
    default:
      return value;
  }
}
