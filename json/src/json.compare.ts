import { JsonValue, JsonObject, JsonArray, JsonCompareResult, JsonDifference } from './types/json.types';

export class JsonCompareError extends Error {
  constructor(
    message: string,
    public path: string = '',
    public valueA?: any,
    public valueB?: any
  ) {
    super(message);
    this.name = 'JsonCompareError';
  }
}

/**
 * Compare two JSON values and return detailed comparison result
 */
export function compareJson(a: JsonValue, b: JsonValue): JsonCompareResult {
  const differences: JsonDifference[] = [];
  const areEqual = deepCompare(a, b, '', differences);
  
  return {
    equal: areEqual,
    differences,
    similarity: calculateSimilarity(a, b)
  };
}

/**
 * Deep equality check for JSON values
 */
export function deepEqual(a: JsonValue, b: JsonValue): boolean {
  return deepCompare(a, b);
}

/**
 * Find differences between two JSON values
 */
export function findDifferences(a: JsonValue, b: JsonValue): JsonObject {
  const differences: JsonDifference[] = [];
  deepCompare(a, b, '', differences);
  
  return formatDifferences(differences);
}

/**
 * Check if JSON a is a subset of JSON b
 */
export function isSubset(a: JsonValue, b: JsonValue): boolean {
  return checkSubset(a, b, '');
}

/**
 * Check if JSON a contains JSON b
 */
export function contains(a: JsonValue, b: JsonValue): boolean {
  return checkContains(a, b, '');
}

/**
 * Compare JSON with tolerance for numeric differences
 */
export function compareWithTolerance(
  a: JsonValue,
  b: JsonValue,
  tolerance: number
): JsonCompareResult {
  const differences: JsonDifference[] = [];
  const areEqual = deepCompareWithTolerance(a, b, '', differences, tolerance);
  
  return {
    equal: areEqual,
    differences,
    similarity: calculateSimilarity(a, b)
  };
}

/**
 * Compare JSON ignoring specific keys
 */
export function compareIgnoringKeys(
  a: JsonValue,
  b: JsonValue,
  keysToIgnore: string[]
): JsonCompareResult {
  const differences: JsonDifference[] = [];
  const filteredA = filterKeys(a, keysToIgnore);
  const filteredB = filterKeys(b, keysToIgnore);
  const areEqual = deepCompare(filteredA, filteredB, '', differences);
  
  return {
    equal: areEqual,
    differences,
    similarity: calculateSimilarity(filteredA, filteredB)
  };
}

/**
 * Compare JSON arrays regardless of order
 */
export function compareArraysUnordered(
  a: JsonArray,
  b: JsonArray
): JsonCompareResult {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    throw new JsonCompareError('Both arguments must be arrays');
  }

  const differences: JsonDifference[] = [];
  
  // Check length
  if (a.length !== b.length) {
    differences.push({
      path: '',
      type: 'length-mismatch',
      valueA: a.length,
      valueB: b.length
    });
    
    return {
      equal: false,
      differences,
      similarity: 0
    };
  }

  // Create copies to avoid modifying originals
  const bCopy = [...b];
  let matches = 0;

  // Try to match each element in a with an element in b
  for (let i = 0; i < a.length; i++) {
    let foundMatch = false;
    
    for (let j = 0; j < bCopy.length; j++) {
      if (deepEqual(a[i], bCopy[j])) {
        foundMatch = true;
        bCopy.splice(j, 1);
        matches++;
        break;
      }
    }
    
    if (!foundMatch) {
      differences.push({
        path: `[${i}]`,
        type: 'missing-element',
        valueA: a[i],
        valueB: undefined
      });
    }
  }

  // Add any remaining elements in bCopy as extra elements
  for (const extra of bCopy) {
    differences.push({
      path: '',
      type: 'extra-element',
      valueA: undefined,
      valueB: extra
    });
  }

  const similarity = a.length > 0 ? matches / a.length : 1;
  
  return {
    equal: differences.length === 0,
    differences,
    similarity
  };
}

/**
 * Get patch operations to transform a into b
 */
export function getPatchOperations(
  a: JsonValue,
  b: JsonValue
): Array<{ op: string; path: string; value?: JsonValue }> {
  const operations: Array<{ op: string; path: string; value?: JsonValue }> = [];
  generatePatch(a, b, '', operations);
  return operations;
}

/**
 * Calculate similarity percentage between two JSON values
 */
export function calculateSimilarity(a: JsonValue, b: JsonValue): number {
  if (a === b) return 1;
  if (a === null || b === null || a === undefined || b === undefined) return 0;
  
  const typeA = getType(a);
  const typeB = getType(b);
  
  if (typeA !== typeB) return 0;
  
  if (typeA === 'array') {
    return calculateArraySimilarity(a as JsonArray, b as JsonArray);
  }
  
  if (typeA === 'object') {
    return calculateObjectSimilarity(a as JsonObject, b as JsonObject);
  }
  
  // For primitives, compare values
  return a === b ? 1 : 0;
}

/**
 * Find common elements between two JSON values
 */
export function findCommon(
  a: JsonValue,
  b: JsonValue
): { common: JsonValue; uniqueToA: JsonValue; uniqueToB: JsonValue } {
  const typeA = getType(a);
  const typeB = getType(b);
  
  if (typeA !== typeB) {
    return {
      common: typeA === 'null' || typeB === 'null' ? null : undefined,
      uniqueToA: a,
      uniqueToB: b
    };
  }
  
  if (typeA === 'array') {
    return findCommonArrays(a as JsonArray, b as JsonArray);
  }
  
  if (typeA === 'object') {
    return findCommonObjects(a as JsonObject, b as JsonObject);
  }
  
  // For primitives
  if (a === b) {
    return {
      common: a,
      uniqueToA: undefined,
      uniqueToB: undefined
    };
  }
  
  return {
    common: undefined,
    uniqueToA: a,
    uniqueToB: b
  };
}

// Helper functions
function deepCompare(
  a: any,
  b: any,
  path: string = '',
  differences: JsonDifference[] = []
): boolean {
  const typeA = getType(a);
  const typeB = getType(b);

  // Type mismatch
  if (typeA !== typeB) {
    differences.push({
      path,
      type: 'type-mismatch',
      valueA: a,
      valueB: b,
      detail: `Type A: ${typeA}, Type B: ${typeB}`
    });
    return false;
  }

  // Handle null/undefined
  if (a === null || b === null || a === undefined || b === undefined) {
    if (a !== b) {
      differences.push({
        path,
        type: 'value-mismatch',
        valueA: a,
        valueB: b
      });
      return false;
    }
    return true;
  }

  // Compare arrays
  if (typeA === 'array') {
    return compareArrays(a, b, path, differences);
  }

  // Compare objects
  if (typeA === 'object') {
    return compareObjects(a, b, path, differences);
  }

  // Compare primitives
  if (a !== b) {
    differences.push({
      path,
      type: 'value-mismatch',
      valueA: a,
      valueB: b
    });
    return false;
  }

  return true;
}

function deepCompareWithTolerance(
  a: any,
  b: any,
  path: string,
  differences: JsonDifference[],
  tolerance: number
): boolean {
  const typeA = getType(a);
  const typeB = getType(b);

  if (typeA !== typeB) {
    differences.push({
      path,
      type: 'type-mismatch',
      valueA: a,
      valueB: b
    });
    return false;
  }

  // Handle numeric comparison with tolerance
  if (typeA === 'number' && typeB === 'number') {
    if (Math.abs(a - b) > tolerance) {
      differences.push({
        path,
        type: 'value-mismatch',
        valueA: a,
        valueB: b,
        detail: `Difference: ${Math.abs(a - b)}, Tolerance: ${tolerance}`
      });
      return false;
    }
    return true;
  }

  // For non-numeric types, use regular comparison
  return deepCompare(a, b, path, differences);
}

function compareArrays(
  a: JsonArray,
  b: JsonArray,
  path: string,
  differences: JsonDifference[]
): boolean {
  let equal = true;

  // Check length
  if (a.length !== b.length) {
    differences.push({
      path,
      type: 'length-mismatch',
      valueA: a.length,
      valueB: b.length
    });
    equal = false;
  }

  // Compare elements
  const maxLength = Math.max(a.length, b.length);
  for (let i = 0; i < maxLength; i++) {
    const elementPath = `${path}[${i}]`;
    
    if (i >= a.length) {
      differences.push({
        path: elementPath,
        type: 'missing-in-a',
        valueA: undefined,
        valueB: b[i]
      });
      equal = false;
    } else if (i >= b.length) {
      differences.push({
        path: elementPath,
        type: 'missing-in-b',
        valueA: a[i],
        valueB: undefined
      });
      equal = false;
    } else {
      const elementEqual = deepCompare(a[i], b[i], elementPath, differences);
      if (!elementEqual) {
        equal = false;
      }
    }
  }

  return equal;
}

function compareObjects(
  a: JsonObject,
  b: JsonObject,
  path: string,
  differences: JsonDifference[]
): boolean {
  let equal = true;
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of allKeys) {
    const propertyPath = path ? `${path}.${key}` : key;
    
    if (!(key in a)) {
      differences.push({
        path: propertyPath,
        type: 'missing-in-a',
        valueA: undefined,
        valueB: b[key]
      });
      equal = false;
    } else if (!(key in b)) {
      differences.push({
        path: propertyPath,
        type: 'missing-in-b',
        valueA: a[key],
        valueB: undefined
      });
      equal = false;
    } else {
      const propertyEqual = deepCompare(a[key], b[key], propertyPath, differences);
      if (!propertyEqual) {
        equal = false;
      }
    }
  }

  return equal;
}

function checkSubset(a: any, b: any, path: string): boolean {
  const typeA = getType(a);
  const typeB = getType(b);

  if (typeA !== typeB) return false;

  if (typeA === 'array') {
    if ((a as JsonArray).length > (b as JsonArray).length) return false;
    
    // Check if all elements of a are in b (order doesn't matter for subset)
    const bCopy = [...(b as JsonArray)];
    for (const elemA of a as JsonArray) {
      let found = false;
      for (let i = 0; i < bCopy.length; i++) {
        if (deepEqual(elemA, bCopy[i])) {
          found = true;
          bCopy.splice(i, 1);
          break;
        }
      }
      if (!found) return false;
    }
    return true;
  }

  if (typeA === 'object') {
    const objA = a as JsonObject;
    const objB = b as JsonObject;
    
    for (const key in objA) {
      if (!(key in objB)) return false;
      if (!checkSubset(objA[key], objB[key], `${path}.${key}`)) return false;
    }
    return true;
  }

  return a === b;
}

function checkContains(a: any, b: any, path: string): boolean {
  return checkSubset(b, a, path);
}

function generatePatch(
  a: any,
  b: any,
  path: string,
  operations: Array<{ op: string; path: string; value?: JsonValue }>
): void {
  const typeA = getType(a);
  const typeB = getType(b);

  // Handle type changes
  if (typeA !== typeB) {
    operations.push({
      op: 'replace',
      path: path || '/',
      value: b
    });
    return;
  }

  // Handle arrays
  if (typeA === 'array') {
    const arrA = a as JsonArray;
    const arrB = b as JsonArray;
    
    // Replace if lengths differ significantly
    if (Math.abs(arrA.length - arrB.length) > Math.min(arrA.length, arrB.length) / 2) {
      operations.push({
        op: 'replace',
        path: path || '/',
        value: b
      });
      return;
    }

    // Generate patch for array elements
    const maxLength = Math.max(arrA.length, arrB.length);
    for (let i = 0; i < maxLength; i++) {
      const elementPath = path ? `${path}/${i}` : `/${i}`;
      
      if (i >= arrA.length) {
        // Add new element
        operations.push({
          op: 'add',
          path: elementPath,
          value: arrB[i]
        });
      } else if (i >= arrB.length) {
        // Remove element
        operations.push({
          op: 'remove',
          path: elementPath
        });
      } else {
        // Compare elements
        generatePatch(arrA[i], arrB[i], elementPath, operations);
      }
    }
    return;
  }

  // Handle objects
  if (typeA === 'object') {
    const objA = a as JsonObject;
    const objB = b as JsonObject;
    const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)]);

    for (const key of allKeys) {
      const propertyPath = path ? `${path}/${key}` : `/${key}`;
      
      if (!(key in objA)) {
        // Add new property
        operations.push({
          op: 'add',
          path: propertyPath,
          value: objB[key]
        });
      } else if (!(key in objB)) {
        // Remove property
        operations.push({
          op: 'remove',
          path: propertyPath
        });
      } else {
        // Compare properties
        generatePatch(objA[key], objB[key], propertyPath, operations);
      }
    }
    return;
  }

  // Handle primitives
  if (a !== b) {
    operations.push({
      op: 'replace',
      path: path || '/',
      value: b
    });
  }
}

function calculateArraySimilarity(a: JsonArray, b: JsonArray): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  let totalSimilarity = 0;
  const maxLength = Math.max(a.length, b.length);

  for (let i = 0; i < maxLength; i++) {
    if (i >= a.length || i >= b.length) {
      totalSimilarity += 0;
    } else {
      totalSimilarity += calculateSimilarity(a[i], b[i]);
    }
  }

  return totalSimilarity / maxLength;
}

function calculateObjectSimilarity(a: JsonObject, b: JsonObject): number {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  if (allKeys.size === 0) return 1;

  let totalSimilarity = 0;
  let keyCount = 0;

  for (const key of allKeys) {
    const valA = a[key];
    const valB = b[key];
    
    if (valA === undefined || valB === undefined) {
      totalSimilarity += 0;
    } else {
      totalSimilarity += calculateSimilarity(valA, valB);
    }
    keyCount++;
  }

  return totalSimilarity / keyCount;
}

function findCommonArrays(a: JsonArray, b: JsonArray): {
  common: JsonArray;
  uniqueToA: JsonArray;
  uniqueToB: JsonArray;
} {
  const common: JsonArray = [];
  const uniqueToA: JsonArray = [];
  const uniqueToB: JsonArray = [...b];

  for (const itemA of a) {
    let found = false;
    for (let i = 0; i < uniqueToB.length; i++) {
      if (deepEqual(itemA, uniqueToB[i])) {
        found = true;
        common.push(itemA);
        uniqueToB.splice(i, 1);
        break;
      }
    }
    if (!found) {
      uniqueToA.push(itemA);
    }
  }

  return { common, uniqueToA, uniqueToB };
}

function findCommonObjects(a: JsonObject, b: JsonObject): {
  common: JsonObject;
  uniqueToA: JsonObject;
  uniqueToB: JsonObject;
} {
  const common: JsonObject = {};
  const uniqueToA: JsonObject = {};
  const uniqueToB: JsonObject = {};

  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of allKeys) {
    const valA = a[key];
    const valB = b[key];

    if (valA !== undefined && valB !== undefined) {
      if (deepEqual(valA, valB)) {
        common[key] = valA;
      } else {
        uniqueToA[key] = valA;
        uniqueToB[key] = valB;
      }
    } else if (valA !== undefined) {
      uniqueToA[key] = valA;
    } else if (valB !== undefined) {
      uniqueToB[key] = valB;
    }
  }

  return { common, uniqueToA, uniqueToB };
}

function filterKeys(json: JsonValue, keysToIgnore: string[]): JsonValue {
  if (Array.isArray(json)) {
    return json.map(item => filterKeys(item, keysToIgnore));
  }
  
  if (typeof json === 'object' && json !== null) {
    const result: JsonObject = {};
    for (const [key, value] of Object.entries(json)) {
      if (!keysToIgnore.includes(key)) {
        result[key] = filterKeys(value, keysToIgnore);
      }
    }
    return result;
  }
  
  return json;
}

function formatDifferences(differences: JsonDifference[]): JsonObject {
  const result: JsonObject = {
    count: differences.length,
    differences: differences.map(diff => ({
      path: diff.path,
      type: diff.type,
      valueA: diff.valueA,
      valueB: diff.valueB,
      detail: diff.detail
    }))
  };

  // Group by type
  const byType: JsonObject = {};
  for (const diff of differences) {
    if (!byType[diff.type]) {
      byType[diff.type] = [];
    }
    byType[diff.type].push({
      path: diff.path,
      valueA: diff.valueA,
      valueB: diff.valueB
    });
  }
  
  result.byType = byType;
  
  return result;
}

function getType(value: any): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return typeof value;
}
