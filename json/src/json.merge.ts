import { JsonValue, JsonObject, JsonArray, JsonMergeOptions, MergeStrategy } from './types/json.types';

export class JsonMergeError extends Error {
  constructor(
    message: string,
    public path: string = '',
    public valueA?: any,
    public valueB?: any
  ) {
    super(message);
    this.name = 'JsonMergeError';
  }
}

/**
 * Deep merge multiple JSON objects
 */
export function mergeJson(
  target: JsonValue,
  ...sources: JsonValue[]
): JsonValue {
  if (sources.length === 0) {
    return deepClone(target);
  }

  let result = deepClone(target);
  
  for (const source of sources) {
    result = deepMergeTwo(result, source, {});
  }
  
  return result;
}

/**
 * Deep merge two JSON objects with options
 */
export function deepMerge(
  target: JsonObject,
  source: JsonObject,
  options: JsonMergeOptions = {}
): JsonObject {
  const {
    strategy = 'deep',
    arrayStrategy = 'concat',
    conflictStrategy = 'source',
    customMerge,
    maxDepth = 100
  } = options;

  return deepMergeRecursive(
    deepClone(target),
    deepClone(source),
    strategy,
    arrayStrategy,
    conflictStrategy,
    customMerge,
    '',
    maxDepth,
    0
  ) as JsonObject;
}

/**
 * Merge arrays with different strategies
 */
export function mergeArrays(
  a: JsonArray,
  b: JsonArray,
  strategy: 'concat' | 'union' | 'intersection' | 'replace' | 'deep' = 'concat'
): JsonArray {
  switch (strategy) {
    case 'concat':
      return [...a, ...b];
    
    case 'union':
      // Remove duplicates
      const combined = [...a, ...b];
      const seen = new Set();
      return combined.filter(item => {
        const key = JSON.stringify(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    
    case 'intersection':
      return a.filter(itemA => 
        b.some(itemB => deepEqual(itemA, itemB))
      );
    
    case 'replace':
      return [...b];
    
    case 'deep':
      // Deep merge array elements by index
      const maxLength = Math.max(a.length, b.length);
      const result: JsonArray = [];
      
      for (let i = 0; i < maxLength; i++) {
        if (i >= a.length) {
          result.push(deepClone(b[i]));
        } else if (i >= b.length) {
          result.push(deepClone(a[i]));
        } else {
          if (typeof a[i] === 'object' && a[i] !== null &&
              typeof b[i] === 'object' && b[i] !== null &&
              !Array.isArray(a[i]) && !Array.isArray(b[i])) {
            // Both are objects, deep merge them
            result.push(deepMergeTwo(a[i] as JsonObject, b[i] as JsonObject, {}));
          } else {
            // Otherwise use source value
            result.push(deepClone(b[i]));
          }
        }
      }
      return result;
    
    default:
      throw new JsonMergeError(`Unknown array merge strategy: ${strategy}`);
  }
}

/**
 * Merge with priority (first non-null/undefined value wins)
 */
export function mergeWithPriority(
  ...objects: JsonObject[]
): JsonObject {
  if (objects.length === 0) return {};
  if (objects.length === 1) return deepClone(objects[0]);

  const result: JsonObject = deepClone(objects[0]);

  for (let i = 1; i < objects.length; i++) {
    result = deepMergeRecursive(
      result,
      objects[i],
      'deep',
      'concat',
      'priority',
      undefined,
      '',
      100,
      0
    ) as JsonObject;
  }

  return result;
}

/**
 * Merge objects, combining arrays by concatenation
 */
export function mergeConcat(
  target: JsonObject,
  source: JsonObject
): JsonObject {
  return deepMerge(target, source, {
    arrayStrategy: 'concat',
    conflictStrategy: 'source'
  });
}

/**
 * Merge objects, combining arrays by union
 */
export function mergeUnion(
  target: JsonObject,
  source: JsonObject
): JsonObject {
  return deepMerge(target, source, {
    arrayStrategy: 'union',
    conflictStrategy: 'source'
  });
}

/**
 * Shallow merge (only top level properties)
 */
export function shallowMerge(
  target: JsonObject,
  source: JsonObject
): JsonObject {
  return { ...target, ...source };
}

/**
 * Merge with transformation
 */
export function mergeWithTransform(
  target: JsonObject,
  source: JsonObject,
  transformer: (key: string, targetVal: any, sourceVal: any) => any
): JsonObject {
  const result = deepClone(target);
  const sourceClone = deepClone(source);

  for (const [key, sourceValue] of Object.entries(sourceClone)) {
    if (key in result) {
      const targetValue = result[key];
      result[key] = transformer(key, targetValue, sourceValue);
    } else {
      result[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Patch JSON object with another (like JSON Patch but simpler)
 */
export function patchJson(
  target: JsonObject,
  patch: JsonObject
): JsonObject {
  const result = deepClone(target);

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      // null means delete the property
      delete result[key];
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Object means recursively patch
      if (key in result && typeof result[key] === 'object' && result[key] !== null) {
        result[key] = patchJson(result[key] as JsonObject, value as JsonObject);
      } else {
        result[key] = deepClone(value);
      }
    } else {
      // Primitive or array means replace
      result[key] = deepClone(value);
    }
  }

  return result;
}

/**
 * Deep clone a JSON value
 */
export function deepClone<T = JsonValue>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => deepClone(item)) as T;
  }

  if (typeof value === 'object') {
    const cloned: JsonObject = {};
    for (const [key, val] of Object.entries(value)) {
      cloned[key] = deepClone(val);
    }
    return cloned as T;
  }

  // Primitive value
  return value;
}

/**
 * Check if merge would cause conflicts
 */
export function checkMergeConflicts(
  target: JsonObject,
  source: JsonObject
): Array<{ path: string; targetValue: any; sourceValue: any }> {
  const conflicts: Array<{ path: string; targetValue: any; sourceValue: any }> = [];
  
  function checkRecursive(t: any, s: any, path: string) {
    if (typeof t === 'object' && t !== null && typeof s === 'object' && s !== null) {
      // Both are objects
      if (Array.isArray(t) && Array.isArray(s)) {
        // Arrays are not considered conflicts
        return;
      } else if (!Array.isArray(t) && !Array.isArray(s)) {
        // Both are plain objects, check properties
        for (const key of Object.keys(s)) {
          const newPath = path ? `${path}.${key}` : key;
          if (key in t) {
            checkRecursive(t[key], s[key], newPath);
          }
        }
      } else {
        // Type mismatch (object vs array)
        conflicts.push({
          path,
          targetValue: t,
          sourceValue: s
        });
      }
    } else if (t !== undefined && s !== undefined && !deepEqual(t, s)) {
      // Different primitive values
      conflicts.push({
        path,
        targetValue: t,
        sourceValue: s
      });
    }
  }

  checkRecursive(target, source, '');
  return conflicts;
}

/**
 * Merge with conflict resolution callback
 */
export function mergeWithResolver(
  target: JsonObject,
  source: JsonObject,
  resolver: (path: string, targetValue: any, sourceValue: any) => any
): JsonObject {
  return deepMergeRecursiveWithResolver(
    deepClone(target),
    deepClone(source),
    resolver,
    '',
    0
  ) as JsonObject;
}

/**
 * Create a merge function with preset options
 */
export function createMerger(options: JsonMergeOptions) {
  return (target: JsonObject, source: JsonObject) => {
    return deepMerge(target, source, options);
  };
}

// Helper functions
function deepMergeTwo(
  target: any,
  source: any,
  options: JsonMergeOptions
): any {
  // Handle null/undefined
  if (source === null || source === undefined) {
    return target;
  }
  
  if (target === null || target === undefined) {
    return deepClone(source);
  }

  // Type mismatch
  const targetType = getValueType(target);
  const sourceType = getValueType(source);
  
  if (targetType !== sourceType) {
    // Use source value if types don't match
    return deepClone(source);
  }

  // Merge arrays
  if (targetType === 'array') {
    const arrayStrategy = options.arrayStrategy || 'concat';
    return mergeArrays(target, source, arrayStrategy);
  }

  // Merge objects
  if (targetType === 'object') {
    const result = deepClone(target);
    const sourceClone = deepClone(source);
    
    for (const [key, sourceValue] of Object.entries(sourceClone)) {
      if (key in result) {
        // Recursive merge
        result[key] = deepMergeTwo(result[key], sourceValue, options);
      } else {
        // New property
        result[key] = sourceValue;
      }
    }
    
    return result;
  }

  // Primitives: use source value
  return deepClone(source);
}

function deepMergeRecursive(
  target: any,
  source: any,
  strategy: MergeStrategy,
  arrayStrategy: string,
  conflictStrategy: string,
  customMerge: ((key: string, tVal: any, sVal: any) => any) | undefined,
  path: string,
  maxDepth: number,
  depth: number
): any {
  // Check depth limit
  if (depth > maxDepth) {
    throw new JsonMergeError(`Maximum merge depth exceeded: ${maxDepth}`, path);
  }

  // Handle null/undefined
  if (source === null || source === undefined) {
    return target;
  }
  
  if (target === null || target === undefined) {
    return deepClone(source);
  }

  // Check for custom merge function
  if (customMerge && typeof customMerge === 'function') {
    const customResult = customMerge(path, target, source);
    if (customResult !== undefined) {
      return customResult;
    }
  }

  const targetType = getValueType(target);
  const sourceType = getValueType(source);

  // Type mismatch
  if (targetType !== sourceType) {
    switch (conflictStrategy) {
      case 'target':
        return deepClone(target);
      case 'source':
        return deepClone(source);
      case 'throw':
        throw new JsonMergeError(
          `Type mismatch at path "${path}": ${targetType} vs ${sourceType}`,
          path,
          target,
          source
        );
      case 'priority':
        // Source takes priority if not null/undefined
        return source !== null && source !== undefined ? 
          deepClone(source) : deepClone(target);
      default:
        return deepClone(source);
    }
  }

  // Handle arrays
  if (targetType === 'array') {
    return mergeArrays(target, source, arrayStrategy as any);
  }

  // Handle objects
  if (targetType === 'object') {
    if (strategy === 'shallow') {
      // Shallow merge for objects
      return { ...target, ...source };
    }

    // Deep merge for objects
    const result = deepClone(target);
    const sourceClone = deepClone(source);

    for (const [key, sourceValue] of Object.entries(sourceClone)) {
      const newPath = path ? `${path}.${key}` : key;
      
      if (key in result) {
        // Recursive merge
        result[key] = deepMergeRecursive(
          result[key],
          sourceValue,
          strategy,
          arrayStrategy,
          conflictStrategy,
          customMerge,
          newPath,
          maxDepth,
          depth + 1
        );
      } else {
        // New property
        result[key] = sourceValue;
      }
    }

    return result;
  }

  // Handle primitives - conflict resolution
  if (target !== source) {
    switch (conflictStrategy) {
      case 'target':
        return target;
      case 'source':
        return source;
      case 'throw':
        throw new JsonMergeError(
          `Value conflict at path "${path}": ${target} vs ${source}`,
          path,
          target,
          source
        );
      case 'priority':
        return source !== null && source !== undefined ? source : target;
      default:
        return source;
    }
  }

  // Values are equal
  return target;
}

function deepMergeRecursiveWithResolver(
  target: any,
  source: any,
  resolver: (path: string, targetValue: any, sourceValue: any) => any,
  path: string,
  depth: number
): any {
  // Handle null/undefined
  if (source === null || source === undefined) {
    return target;
  }
  
  if (target === null || target === undefined) {
    return deepClone(source);
  }

  const targetType = getValueType(target);
  const sourceType = getValueType(source);

  // Type mismatch or different values
  if (targetType !== sourceType || !deepEqual(target, source)) {
    const resolved = resolver(path, target, source);
    if (resolved !== undefined) {
      return resolved;
    }
    
    // If resolver returns undefined, fall back to source
    return deepClone(source);
  }

  // Same type and value for primitives
  if (targetType !== 'array' && targetType !== 'object') {
    return target;
  }

  // Handle arrays
  if (targetType === 'array') {
    // For arrays, we need to merge element by element
    const maxLength = Math.max(target.length, source.length);
    const result: any[] = [];
    
    for (let i = 0; i < maxLength; i++) {
      const elementPath = `${path}[${i}]`;
      const targetElement = i < target.length ? target[i] : undefined;
      const sourceElement = i < source.length ? source[i] : undefined;
      
      if (targetElement === undefined) {
        result.push(deepClone(sourceElement));
      } else if (sourceElement === undefined) {
        result.push(deepClone(targetElement));
      } else {
        result.push(deepMergeRecursiveWithResolver(
          targetElement,
          sourceElement,
          resolver,
          elementPath,
          depth + 1
        ));
      }
    }
    
    return result;
  }

  // Handle objects
  const result = deepClone(target);
  const sourceClone = deepClone(source);

  for (const [key, sourceValue] of Object.entries(sourceClone)) {
    const newPath = path ? `${path}.${key}` : key;
    
    if (key in result) {
      result[key] = deepMergeRecursiveWithResolver(
        result[key],
        sourceValue,
        resolver,
        newPath,
        depth + 1
      );
    } else {
      result[key] = sourceValue;
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

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
        return false;
      }
    }
    
    return true;
  }
  
  return false;
}
