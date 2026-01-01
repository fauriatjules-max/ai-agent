import { JsonValue, JsonObject, JsonArray, JsonPathResult, JsonPathOptions } from './types/json.types';

export class JsonPathError extends Error {
  constructor(
    message: string,
    public path: string = '',
    public value?: any
  ) {
    super(message);
    this.name = 'JsonPathError';
  }
}

/**
 * Evaluate JSON path expression on JSON data
 */
export function jsonPath(
  json: JsonValue,
  expression: string,
  options: JsonPathOptions = {}
): JsonPathResult {
  const {
    create = false,
    delete: deleteFlag = false,
    value: newValue,
    multiple = false
  } = options;

  // Parse the path expression
  const segments = parsePathExpression(expression);
  
  if (segments.length === 0) {
    return {
      value: json,
      parent: null,
      key: '',
      exists: true,
      target: json
    };
  }

  // Traverse the JSON
  let current: any = json;
  let parent: any = null;
  let parentKey: string | number = '';
  let exists = true;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const isLast = i === segments.length - 1;

    if (current === undefined || current === null) {
      exists = false;
      if (!create) {
        throw new JsonPathError(`Cannot traverse null/undefined at path: ${getPathString(segments.slice(0, i))}`, expression);
      }
      
      // Create missing structure if in create mode
      if (isLast) {
        current = createDefaultValue(segment, segments[i + 1]);
      } else {
        const nextSegment = segments[i + 1];
        current = createDefaultValue(nextSegment, segments[i + 2]);
      }
      
      if (parent !== null) {
        if (Array.isArray(parent)) {
          parent[parentKey as number] = current;
        } else {
          (parent as JsonObject)[parentKey as string] = current;
        }
      }
    }

    // Store parent before moving deeper
    parent = current;
    parentKey = segment;

    // Handle array index
    if (Array.isArray(current)) {
      if (typeof segment === 'number') {
        if (segment < 0) {
          // Negative index: count from end
          const adjustedIndex = current.length + segment;
          if (adjustedIndex < 0 || adjustedIndex >= current.length) {
            if (create) {
              // Extend array if needed
              while (current.length <= adjustedIndex) {
                current.push(undefined);
              }
            } else {
              throw new JsonPathError(`Array index out of bounds: ${segment}`, expression);
            }
          }
          current = current[adjustedIndex];
        } else {
          if (segment >= current.length) {
            if (create) {
              // Extend array if needed
              while (current.length <= segment) {
                current.push(undefined);
              }
            } else {
              throw new JsonPathError(`Array index out of bounds: ${segment}`, expression);
            }
          }
          current = current[segment];
        }
      } else {
        throw new JsonPathError(`Expected array index, got: ${segment}`, expression);
      }
    }
    // Handle object property
    else if (typeof current === 'object' && current !== null) {
      if (typeof segment === 'string') {
        if (!(segment in current)) {
          if (create) {
            if (isLast) {
              current[segment] = undefined;
            } else {
              const nextSegment = segments[i + 1];
              current[segment] = createDefaultValue(nextSegment, segments[i + 2]);
            }
          } else if (!isLast) {
            exists = false;
            break;
          }
        }
        current = current[segment];
      } else {
        throw new JsonPathError(`Expected object key, got: ${segment}`, expression);
      }
    }
    // Handle primitive value (can't go deeper)
    else {
      if (create && isLast) {
        // Replace primitive with object/array if creating
        const defaultValue = createDefaultValue(segment, segments[i + 1]);
        if (parent !== null) {
          if (Array.isArray(parent)) {
            parent[parentKey as number] = defaultValue;
          } else {
            parent[parentKey as string] = defaultValue;
          }
        }
        current = defaultValue;
      } else {
        exists = false;
        break;
      }
    }
  }

  // Handle final operations
  if (exists) {
    if (deleteFlag) {
      if (parent !== null) {
        if (Array.isArray(parent)) {
          parent.splice(parentKey as number, 1);
        } else {
          delete parent[parentKey as string];
        }
      }
      return {
        value: undefined,
        parent,
        key: parentKey,
        exists: false,
        target: json
      };
    }

    if (newValue !== undefined) {
      if (parent !== null) {
        if (Array.isArray(parent)) {
          parent[parentKey as number] = newValue;
        } else {
          parent[parentKey as string] = newValue;
        }
      } else {
        // Root level replacement
        current = newValue;
      }
      return {
        value: newValue,
        parent,
        key: parentKey,
        exists: true,
        target: json
      };
    }

    return {
      value: current,
      parent,
      key: parentKey,
      exists: true,
      target: json
    };
  } else {
    // Path doesn't exist
    if (create && newValue !== undefined) {
      if (parent !== null) {
        if (Array.isArray(parent)) {
          parent[parentKey as number] = newValue;
        } else {
          parent[parentKey as string] = newValue;
        }
        return {
          value: newValue,
          parent,
          key: parentKey,
          exists: true,
          target: json
        };
      }
    }

    return {
      value: undefined,
      parent,
      key: parentKey,
      exists: false,
      target: json
    };
  }
}

/**
 * Get value at JSON path
 */
export function getValue(json: JsonValue, path: string): JsonValue | undefined {
  try {
    const result = jsonPath(json, path);
    return result.value;
  } catch {
    return undefined;
  }
}

/**
 * Set value at JSON path
 */
export function setValue(json: JsonValue, path: string, value: JsonValue): JsonValue {
  const result = jsonPath(json, path, { create: true, value });
  return result.target;
}

/**
 * Delete value at JSON path
 */
export function deleteValue(json: JsonValue, path: string): JsonValue {
  jsonPath(json, path, { delete: true });
  return json;
}

/**
 * Check if path exists in JSON
 */
export function hasPath(json: JsonValue, path: string): boolean {
  try {
    const result = jsonPath(json, path);
    return result.exists;
  } catch {
    return false;
  }
}

/**
 * Get all paths in JSON object
 */
export function getAllPaths(
  json: JsonValue,
  options: {
    includeArrays?: boolean;
    includeObjects?: boolean;
    includePrimitives?: boolean;
    delimiter?: string;
    maxDepth?: number;
  } = {}
): string[] {
  const {
    includeArrays = true,
    includeObjects = true,
    includePrimitives = true,
    delimiter = '.',
    maxDepth = 100
  } = options;

  const paths: string[] = [];
  
  function traverse(current: any, currentPath: string[], depth: number) {
    if (depth > maxDepth) return;

    const currentType = getValueType(current);
    const pathStr = currentPath.join(delimiter);

    // Add current path if it matches criteria
    if (currentType === 'array' && includeArrays && currentPath.length > 0) {
      paths.push(pathStr);
    } else if (currentType === 'object' && includeObjects && currentPath.length > 0) {
      paths.push(pathStr);
    } else if (currentType !== 'array' && currentType !== 'object' && includePrimitives) {
      paths.push(pathStr);
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
  return paths;
}

/**
 * Find paths matching a pattern
 */
export function findPaths(
  json: JsonValue,
  pattern: string | RegExp | ((path: string, value: JsonValue) => boolean)
): Array<{ path: string; value: JsonValue }> {
  const results: Array<{ path: string; value: JsonValue }> = [];
  const paths = getAllPaths(json, { includePrimitives: true });

  for (const path of paths) {
    const value = getValue(json, path);
    if (value === undefined) continue;

    let matches = false;
    
    if (typeof pattern === 'string') {
      matches = path.includes(pattern);
    } else if (pattern instanceof RegExp) {
      matches = pattern.test(path);
    } else if (typeof pattern === 'function') {
      matches = pattern(path, value);
    }

    if (matches) {
      results.push({ path, value });
    }
  }

  return results;
}

/**
 * Extract values from multiple paths
 */
export function extractPaths(
  json: JsonValue,
  paths: string[]
): Record<string, JsonValue> {
  const result: Record<string, JsonValue> = {};
  
  for (const path of paths) {
    const value = getValue(json, path);
    if (value !== undefined) {
      result[path] = value;
    }
  }
  
  return result;
}

/**
 * Update multiple paths at once
 */
export function updatePaths(
  json: JsonValue,
  updates: Record<string, JsonValue>
): JsonValue {
  let result = json;
  
  for (const [path, value] of Object.entries(updates)) {
    result = setValue(result, path, value);
  }
  
  return result;
}

/**
 * Move value from one path to another
 */
export function moveValue(
  json: JsonValue,
  fromPath: string,
  toPath: string
): JsonValue {
  const fromResult = jsonPath(json, fromPath);
  if (!fromResult.exists) {
    throw new JsonPathError(`Source path does not exist: ${fromPath}`, fromPath);
  }

  const value = fromResult.value;
  
  // Delete from source
  const afterDelete = deleteValue(json, fromPath);
  
  // Set to destination
  return setValue(afterDelete, toPath, value);
}

/**
 * Copy value from one path to another
 */
export function copyValue(
  json: JsonValue,
  fromPath: string,
  toPath: string
): JsonValue {
  const value = getValue(json, fromPath);
  if (value === undefined) {
    throw new JsonPathError(`Source path does not exist: ${fromPath}`, fromPath);
  }

  return setValue(json, toPath, JSON.parse(JSON.stringify(value)));
}

/**
 * Get parent path of a given path
 */
export function getParentPath(path: string, delimiter: string = '.'): string {
  const segments = parsePathExpression(path);
  if (segments.length <= 1) return '';
  
  return segments.slice(0, -1).map(s => 
    typeof s === 'number' ? `[${s}]` : s
  ).join(delimiter).replace(/\.\[/g, '[');
}

/**
 * Get path depth
 */
export function getPathDepth(path: string): number {
  const segments = parsePathExpression(path);
  return segments.length;
}

/**
 * Normalize path expression
 */
export function normalizePath(path: string, delimiter: string = '.'): string {
  const segments = parsePathExpression(path);
  return segments.map(s => 
    typeof s === 'number' ? `[${s}]` : s
  ).join(delimiter).replace(/\.\[/g, '[');
}

// Helper functions
function parsePathExpression(expression: string): Array<string | number> {
  if (expression === '') return [];
  
  const segments: Array<string | number> = [];
  let current = '';
  let inBrackets = false;
  let quoteChar = '';
  
  for (let i = 0; i < expression.length; i++) {
    const char = expression[i];
    
    if (inBrackets) {
      if (quoteChar) {
        if (char === quoteChar && expression[i - 1] !== '\\') {
          quoteChar = '';
        }
        current += char;
      } else {
        if (char === '"' || char === "'") {
          quoteChar = char;
          current += char;
        } else if (char === ']') {
          inBrackets = false;
          // Parse the content inside brackets
          const content = current.trim();
          if (content === '') {
            throw new JsonPathError('Empty bracket expression', expression);
          }
          
          if (/^-?\d+$/.test(content)) {
            // Array index
            segments.push(parseInt(content, 10));
          } else if ((content.startsWith('"') && content.endsWith('"')) || 
                     (content.startsWith("'") && content.endsWith("'"))) {
            // Quoted string
            segments.push(content.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'"));
          } else {
            // Unquoted string (property name)
            segments.push(content);
          }
          current = '';
        } else {
          current += char;
        }
      }
    } else {
      if (char === '.') {
        if (current !== '') {
          segments.push(current);
          current = '';
        }
      } else if (char === '[') {
        if (current !== '') {
          segments.push(current);
          current = '';
        }
        inBrackets = true;
      } else {
        current += char;
      }
    }
  }
  
  // Handle remaining segment
  if (current !== '') {
    segments.push(current);
  }
  
  if (inBrackets) {
    throw new JsonPathError('Unclosed bracket in path expression', expression);
  }
  
  return segments;
}

function createDefaultValue(currentSegment: string | number, nextSegment?: string | number): any {
  if (typeof nextSegment === 'number' || (typeof nextSegment === 'string' && nextSegment === '0')) {
    return [];
  } else if (typeof nextSegment === 'string') {
    return {};
  }
  
  // If no next segment, create based on current segment type
  if (typeof currentSegment === 'number') {
    return [];
  } else {
    return {};
  }
}

function getPathString(segments: Array<string | number>): string {
  return segments.map(s => 
    typeof s === 'number' ? `[${s}]` : s
  ).join('.').replace(/\.\[/g, '[');
}

function getValueType(value: any): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return typeof value;
}
