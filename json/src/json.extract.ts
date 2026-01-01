import { JsonValue, JsonObject, JsonArray, JsonExtractOptions, JsonPathPattern } from './types/json.types';
import { jsonPath, getValue } from './json.path';
import { deepEqual } from './json.compare';

export class JsonExtractError extends Error {
  constructor(
    message: string,
    public path: string = '',
    public value?: any
  ) {
    super(message);
    this.name = 'JsonExtractError';
  }
}

/**
 * Extract values from JSON using path patterns
 */
export function extractValues(
  json: JsonValue,
  patterns: string[] | JsonPathPattern[],
  options: JsonExtractOptions = {}
): JsonObject {
  const {
    defaultValue,
    flatten = true,
    includeMissing = false,
    transform
  } = options;

  const result: JsonObject = {};

  // Normalize patterns
  const normalizedPatterns = Array.isArray(patterns[0]) 
    ? patterns as JsonPathPattern[]
    : (patterns as string[]).map(pattern => ({ pattern }));

  for (const { pattern, alias, filter } of normalizedPatterns) {
    try {
      const values = extractByPattern(json, pattern, { filter });
      
      if (values.length === 0 && includeMissing) {
        const key = alias || pattern;
        result[key] = defaultValue;
      } else if (values.length === 1) {
        const key = alias || pattern;
        let value = values[0];
        
        // Apply transform if provided
        if (transform && typeof transform === 'function') {
          value = transform(value, pattern, key);
        }
        
        result[key] = value;
      } else if (values.length > 1) {
        const key = alias || pattern;
        let valueArray = [...values];
        
        // Apply transform if provided
        if (transform && typeof transform === 'function') {
          valueArray = valueArray.map(val => transform(val, pattern, key));
        }
        
        result[key] = valueArray;
      }
    } catch (error: any) {
      if (includeMissing) {
        const key = alias || pattern;
        result[key] = defaultValue;
      }
    }
  }

  // Flatten nested objects if requested
  if (flatten) {
    return flattenObject(result);
  }

  return result;
}

/**
 * Extract values from JSON using a single path pattern
 */
export function extractByPath(
  json: JsonValue,
  path: string,
  options: {
    filter?: (value: JsonValue, path: string) => boolean;
    unique?: boolean;
    flatten?: boolean;
  } = {}
): JsonValue | JsonValue[] {
  const { filter, unique = false, flatten = true } = options;
  
  const values = extractByPattern(json, path, { filter });
  
  if (values.length === 0) {
    return undefined as any;
  }
  
  if (values.length === 1) {
    return flatten ? flattenValue(values[0]) : values[0];
  }
  
  let result = values;
  
  // Remove duplicates if requested
  if (unique) {
    result = removeDuplicates(result);
  }
  
  // Flatten if requested
  if (flatten) {
    result = result.map(flattenValue);
  }
  
  return result;
}

/**
 * Extract specific keys from JSON object
 */
export function extractKeys(
  json: JsonObject,
  keys: string[],
  options: {
    defaultValue?: any;
    includeMissing?: boolean;
    rename?: Record<string, string>;
  } = {}
): JsonObject {
  const {
    defaultValue,
    includeMissing = false,
    rename = {}
  } = options;

  const result: JsonObject = {};

  for (const key of keys) {
    if (key in json) {
      const newKey = rename[key] || key;
      result[newKey] = json[key];
    } else if (includeMissing) {
      const newKey = rename[key] || key;
      result[newKey] = defaultValue;
    }
  }

  return result;
}

/**
 * Extract values matching a predicate
 */
export function extractByPredicate(
  json: JsonValue,
  predicate: (value: JsonValue, path: string) => boolean,
  options: {
    maxDepth?: number;
    includePath?: boolean;
  } = {}
): Array<JsonValue | { path: string; value: JsonValue }> {
  const { maxDepth = 100, includePath = false } = options;
  const results: Array<JsonValue | { path: string; value: JsonValue }> = [];
  
  function traverse(current: any, currentPath: string[], depth: number) {
    if (depth > maxDepth) return;

    const pathStr = currentPath.join('.');
    
    // Check current value
    if (predicate(current, pathStr)) {
      if (includePath) {
        results.push({ path: pathStr, value: current });
      } else {
        results.push(current);
      }
    }

    // Recurse into children
    if (Array.isArray(current)) {
      for (let i = 0; i < current.length; i++) {
        traverse(current[i], [...currentPath, i.toString()], depth + 1);
      }
    } else if (typeof current === 'object' && current !== null) {
      for (const [key, value] of Object.entries(current)) {
        traverse(value, [...currentPath, key], depth + 1);
      }
    }
  }

  traverse(json, [], 0);
  return results;
}

/**
 * Extract values of specific type
 */
export function extractByType(
  json: JsonValue,
  type: string | string[],
  options: {
    includePath?: boolean;
    maxDepth?: number;
  } = {}
): Array<JsonValue | { path: string; value: JsonValue; type: string }> {
  const types = Array.isArray(type) ? type : [type];
  
  return extractByPredicate(json, (value, path) => {
    const valueType = getValueType(value);
    return types.includes(valueType);
  }, options).map(item => {
    if (typeof item === 'object' && item !== null && 'path' in item) {
      return {
        ...item,
        type: getValueType(item.value)
      };
    }
    return item;
  }) as any;
}

/**
 * Extract values matching a regex pattern
 */
export function extractByRegex(
  json: JsonValue,
  pattern: RegExp,
  options: {
    searchKeys?: boolean;
    searchValues?: boolean;
    caseSensitive?: boolean;
    maxDepth?: number;
  } = {}
): Array<{ path: string; key?: string; value: JsonValue }> {
  const {
    searchKeys = true,
    searchValues = true,
    caseSensitive = true,
    maxDepth = 100
  } = options;

  const results: Array<{ path: string; key?: string; value: JsonValue }> = [];
  const regex = caseSensitive ? pattern : new RegExp(pattern.source, 'i');

  function traverse(current: any, currentPath: string[], depth: number) {
    if (depth > maxDepth) return;

    const pathStr = currentPath.join('.');

    // Check current value if it's a string
    if (searchValues && typeof current === 'string') {
      if (regex.test(current)) {
        results.push({
          path: pathStr,
          value: current
        });
      }
    }

    // Recurse into children
    if (Array.isArray(current)) {
      for (let i = 0; i < current.length; i++) {
        traverse(current[i], [...currentPath, i.toString()], depth + 1);
      }
    } else if (typeof current === 'object' && current !== null) {
      for (const [key, value] of Object.entries(current)) {
        // Check key if requested
        if (searchKeys && regex.test(key)) {
          results.push({
            path: pathStr ? `${pathStr}.${key}` : key,
            key,
            value
          });
        }
        
        traverse(value, [...currentPath, key], depth + 1);
      }
    }
  }

  traverse(json, [], 0);
  return results;
}

/**
 * Extract nested objects and flatten them
 */
export function extractAndFlatten(
  json: JsonValue,
  path: string,
  options: {
    delimiter?: string;
    prefix?: string;
    excludeKeys?: string[];
  } = {}
): JsonObject {
  const {
    delimiter = '.',
    prefix = '',
    excludeKeys = []
  } = options;

  const extracted = extractByPath(json, path, { flatten: false });
  
  if (extracted === undefined || extracted === null) {
    return {};
  }

  if (!Array.isArray(extracted)) {
    return flattenObject(extracted as JsonObject, delimiter, prefix, excludeKeys);
  }

  // Handle array of objects
  const result: JsonObject = {};
  (extracted as JsonArray).forEach((item, index) => {
    if (typeof item === 'object' && item !== null) {
      const flattened = flattenObject(item as JsonObject, delimiter, `${prefix}${index}`, excludeKeys);
      Object.assign(result, flattened);
    }
  });

  return result;
}

/**
 * Extract and group values
 */
export function extractAndGroup(
  json: JsonValue,
  groupBy: string,
  extract: string[],
  options: {
    defaultValue?: any;
    includeMissing?: boolean;
  } = {}
): JsonObject {
  const { defaultValue, includeMissing = false } = options;
  
  // First, extract the data
  const data = extractByPath(json, groupBy, { flatten: false });
  
  if (!Array.isArray(data)) {
    throw new JsonExtractError(`Group by path "${groupBy}" must return an array`);
  }

  const groups: JsonObject = {};

  for (const item of data as JsonArray) {
    if (typeof item !== 'object' || item === null) continue;

    const groupKey = (item as JsonObject)[groupBy];
    if (groupKey === undefined) continue;

    const key = String(groupKey);
    
    if (!groups[key]) {
      groups[key] = [];
    }

    const extractedItem: JsonObject = {};
    for (const field of extract) {
      if (field in item) {
        extractedItem[field] = (item as JsonObject)[field];
      } else if (includeMissing) {
        extractedItem[field] = defaultValue;
      }
    }

    (groups[key] as JsonArray).push(extractedItem);
  }

  return groups;
}

/**
 * Extract and pivot data
 */
export function extractAndPivot(
  json: JsonValue,
  rows: string,
  columns: string,
  values: string,
  options: {
    aggregate?: 'sum' | 'avg' | 'count' | 'first' | 'last';
    defaultValue?: any;
  } = {}
): JsonObject {
  const { aggregate = 'sum', defaultValue = 0 } = options;

  const data = extractByPath(json, rows, { flatten: false });
  
  if (!Array.isArray(data)) {
    throw new JsonExtractError(`Rows path "${rows}" must return an array`);
  }

  const pivot: JsonObject = {};
  const columnValues = new Set();

  // First pass: collect data and column values
  for (const item of data as JsonArray) {
    if (typeof item !== 'object' || item === null) continue;

    const rowKey = (item as JsonObject)[rows];
    const colKey = (item as JsonObject)[columns];
    const value = (item as JsonObject)[values];

    if (rowKey === undefined || colKey === undefined || value === undefined) {
      continue;
    }

    const rowStr = String(rowKey);
    const colStr = String(colKey);

    columnValues.add(colStr);

    if (!pivot[rowStr]) {
      pivot[rowStr] = {};
    }

    const cell = (pivot[rowStr] as JsonObject)[colStr];
    
    if (cell === undefined) {
      (pivot[rowStr] as JsonObject)[colStr] = value;
    } else {
      // Aggregate values
      switch (aggregate) {
        case 'sum':
          (pivot[rowStr] as JsonObject)[colStr] = (cell as number) + (value as number);
          break;
        case 'avg':
          // Store sum and count for later averaging
          if (!(pivot[rowStr] as JsonObject)._count) {
            (pivot[rowStr] as JsonObject)._count = {};
          }
          if (!(pivot[rowStr] as JsonObject)._sum) {
            (pivot[rowStr] as JsonObject)._sum = {};
          }
          
          const countObj = (pivot[rowStr] as JsonObject)._count as JsonObject;
          const sumObj = (pivot[rowStr] as JsonObject)._sum as JsonObject;
          
          countObj[colStr] = (countObj[colStr] || 0) + 1;
          sumObj[colStr] = (sumObj[colStr] || 0) + (value as number);
          (pivot[rowStr] as JsonObject)[colStr] = sumObj[colStr];
          break;
        case 'count':
          (pivot[rowStr] as JsonObject)[colStr] = (cell as number) + 1;
          break;
        case 'first':
          // Keep first value (already set)
          break;
        case 'last':
          (pivot[rowStr] as JsonObject)[colStr] = value;
          break;
      }
    }
  }

  // Second pass: calculate averages if needed
  if (aggregate === 'avg') {
    for (const rowKey of Object.keys(pivot)) {
      const row = pivot[rowKey] as JsonObject;
      const countObj = row._count as JsonObject;
      const sumObj = row._sum as JsonObject;

      if (countObj && sumObj) {
        for (const colKey of Object.keys(countObj)) {
          if (sumObj[colKey] !== undefined) {
            row[colKey] = (sumObj[colKey] as number) / (countObj[colKey] as number);
          }
        }

        // Remove helper objects
        delete row._count;
        delete row._sum;
      }
    }
  }

  // Ensure all rows have all columns
  const columnArray = Array.from(columnValues);
  for (const rowKey of Object.keys(pivot)) {
    const row = pivot[rowKey] as JsonObject;
    for (const col of columnArray) {
      if (row[col] === undefined) {
        row[col] = defaultValue;
      }
    }
  }

  return pivot;
}

/**
 * Extract and transform using a template
 */
export function extractWithTemplate(
  json: JsonValue,
  template: JsonObject,
  options: {
    defaultValue?: any;
    strict?: boolean;
  } = {}
): JsonObject {
  const { defaultValue, strict = false } = options;
  const result: JsonObject = {};

  function processTemplate(tmpl: any, data: any): any {
    if (typeof tmpl === 'string') {
      // Check if it's a path reference
      if (tmpl.startsWith('$.')) {
        const path = tmpl.substring(2);
        const value = getValue(data, path);
        return value !== undefined ? value : defaultValue;
      }
      return tmpl;
    }
    
    if (Array.isArray(tmpl)) {
      return tmpl.map(item => processTemplate(item, data));
    }
    
    if (typeof tmpl === 'object' && tmpl !== null) {
      const objResult: JsonObject = {};
      for (const [key, value] of Object.entries(tmpl)) {
        objResult[key] = processTemplate(value, data);
      }
      return objResult;
    }
    
    return tmpl;
  }

  return processTemplate(template, json) as JsonObject;
}

// Helper functions
function extractByPattern(
  json: JsonValue,
  pattern: string,
  options: {
    filter?: (value: JsonValue, path: string) => boolean;
  } = {}
): JsonValue[] {
  const { filter } = options;
  const results: JsonValue[] = [];

  // Check if pattern contains wildcards
  if (pattern.includes('*') || pattern.includes('?')) {
    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    
    // Get all paths and filter by pattern
    const allPaths = getAllPaths(json);
    for (const path of allPaths) {
      if (regex.test(path)) {
        const value = getValue(json, path);
        if (value !== undefined && (!filter || filter(value, path))) {
          results.push(value);
        }
      }
    }
  } else {
    // Simple path - try to get value
    const value = getValue(json, pattern);
    if (value !== undefined && (!filter || filter(value, pattern))) {
      results.push(value);
    }
  }

  return results;
}

function getAllPaths(json: JsonValue): string[] {
  const paths: string[] = [];
  
  function traverse(current: any, currentPath: string[]) {
    const pathStr = currentPath.join('.');
    paths.push(pathStr);

    if (Array.isArray(current)) {
      for (let i = 0; i < current.length; i++) {
        traverse(current[i], [...currentPath, i.toString()]);
      }
    } else if (typeof current === 'object' && current !== null) {
      for (const [key, value] of Object.entries(current)) {
        traverse(value, [...currentPath, key]);
      }
    }
  }

  traverse(json, []);
  return paths;
}

function flattenObject(
  obj: JsonObject,
  delimiter: string = '.',
  prefix: string = '',
  excludeKeys: string[] = []
): JsonObject {
  const result: JsonObject = {};

  for (const [key, value] of Object.entries(obj)) {
    if (excludeKeys.includes(key)) continue;

    const newKey = prefix ? `${prefix}${delimiter}${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const flattened = flattenObject(value as JsonObject, delimiter, newKey, excludeKeys);
      Object.assign(result, flattened);
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

function flattenValue(value: JsonValue): JsonValue {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return flattenObject(value as JsonObject);
  }
  return value;
}

function removeDuplicates(values: JsonValue[]): JsonValue[] {
  const seen = new Set<string>();
  const result: JsonValue[] = [];

  for (const value of values) {
    const key = JSON.stringify(value);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }

  return result;
}

function getValueType(value: any): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return typeof value;
}
