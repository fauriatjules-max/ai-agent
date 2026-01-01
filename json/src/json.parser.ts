import { JsonValue, JsonObject, JsonArray } from './types/json.types';

export class JsonParseError extends Error {
  constructor(
    message: string,
    public position?: number,
    public source?: string
  ) {
    super(message);
    this.name = 'JsonParseError';
  }
}

export class JsonStringifyError extends Error {
  constructor(
    message: string,
    public value?: any
  ) {
    super(message);
    this.name = 'JsonStringifyError';
  }
}

/**
 * Parse JSON string with detailed error information
 */
export function parseJson<T = JsonValue>(
  jsonString: string, 
  reviver?: (key: string, value: any) => any
): T {
  if (typeof jsonString !== 'string') {
    throw new JsonParseError('Input must be a string', 0, jsonString);
  }

  // Check for empty string
  if (jsonString.trim() === '') {
    throw new JsonParseError('Empty string cannot be parsed as JSON', 0, jsonString);
  }

  try {
    // Use native JSON.parse with reviver
    return JSON.parse(jsonString, reviver);
  } catch (error: any) {
    // Provide better error messages
    const positionMatch = error.message.match(/position\s+(\d+)/);
    const position = positionMatch ? parseInt(positionMatch[1]) : undefined;
    
    let enhancedMessage = error.message;
    
    if (position !== undefined && jsonString) {
      // Show context around the error
      const start = Math.max(0, position - 20);
      const end = Math.min(jsonString.length, position + 20);
      const context = jsonString.substring(start, end);
      const pointer = ' '.repeat(Math.min(20, position - start)) + '^';
      
      enhancedMessage += `\nContext: "${context}"\n${pointer}`;
    }
    
    throw new JsonParseError(enhancedMessage, position, jsonString);
  }
}

/**
 * Stringify JSON with error handling and formatting options
 */
export function stringifyJson(
  value: JsonValue,
  replacer?: (string | number)[] | null,
  space?: string | number
): string {
  try {
    // Handle circular references
    const seen = new WeakSet();
    
    const customReplacer = (key: string, val: any) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) {
          return '[Circular Reference]';
        }
        seen.add(val);
      }
      
      // Apply user replacer if provided
      if (replacer && Array.isArray(replacer)) {
        if (key === '' || replacer.includes(key)) {
          return val;
        }
        return undefined;
      }
      
      // Handle special values
      if (val === undefined) {
        return null; // JSON.stringify converts undefined to null
      }
      
      if (typeof val === 'bigint') {
        return val.toString(); // Convert BigInt to string
      }
      
      if (val instanceof Date) {
        return val.toISOString();
      }
      
      if (val instanceof Map) {
        return Object.fromEntries(val);
      }
      
      if (val instanceof Set) {
        return Array.from(val);
      }
      
      return val;
    };
    
    const result = JSON.stringify(value, customReplacer, space);
    
    if (result === undefined) {
      throw new JsonStringifyError('Failed to stringify value: returned undefined', value);
    }
    
    return result;
  } catch (error: any) {
    if (error instanceof JsonStringifyError) {
      throw error;
    }
    throw new JsonStringifyError(`Failed to stringify value: ${error.message}`, value);
  }
}

/**
 * Parse JSON with a schema validator
 */
export function parseWithSchema<T = JsonValue>(
  jsonString: string,
  schema: any,
  reviver?: (key: string, value: any) => any
): T {
  const parsed = parseJson(jsonString, reviver);
  
  // Basic schema validation (could be extended with JSON Schema)
  if (schema && typeof schema === 'object') {
    validateAgainstSchema(parsed, schema);
  }
  
  return parsed as T;
}

/**
 * Parse multiple JSON strings
 */
export function parseMultiple<T = JsonValue>(
  jsonStrings: string[],
  reviver?: (key: string, value: any) => any
): T[] {
  return jsonStrings.map(json => parseJson(json, reviver));
}

/**
 * Stringify with custom formatting rules
 */
export function stringifyWithFormat(
  value: JsonValue,
  options: {
    indent?: number;
    sortKeys?: boolean;
    maxLength?: number;
    replacer?: (key: string, value: any) => any;
  } = {}
): string {
  const { indent = 2, sortKeys = false, maxLength, replacer } = options;
  
  let result = stringifyJson(value, null, indent);
  
  // Sort keys if requested
  if (sortKeys) {
    const parsed = parseJson(result);
    result = stringifyJson(sortObjectKeys(parsed), null, indent);
  }
  
  // Truncate if maxLength specified
  if (maxLength && result.length > maxLength) {
    result = result.substring(0, maxLength) + '...';
  }
  
  return result;
}

/**
 * Validate if string is valid JSON
 */
export function isValidJson(jsonString: string): boolean {
  try {
    parseJson(jsonString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get JSON string size in bytes
 */
export function getJsonSize(json: JsonValue): number {
  return new Blob([stringifyJson(json)]).size;
}

/**
 * Minify JSON string
 */
export function minifyJson(jsonString: string): string {
  try {
    const parsed = parseJson(jsonString);
    return stringifyJson(parsed);
  } catch {
    return jsonString.replace(/\s+/g, '');
  }
}

/**
 * Pretty print JSON
 */
export function prettyPrint(json: JsonValue, indent: number = 2): string {
  return stringifyJson(json, null, indent);
}

// Helper functions
function validateAgainstSchema(json: JsonValue, schema: any): void {
  // Basic type checking
  if (schema.type) {
    const type = schema.type;
    const jsonType = getJsonType(json);
    
    if (type !== jsonType) {
      throw new JsonParseError(`Type mismatch: expected ${type}, got ${jsonType}`);
    }
  }
  
  // Required fields for objects
  if (schema.required && Array.isArray(schema.required)) {
    if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
      for (const field of schema.required) {
        if (!(field in json)) {
          throw new JsonParseError(`Missing required field: ${field}`);
        }
      }
    }
  }
}

function getJsonType(value: JsonValue): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function sortObjectKeys(obj: JsonValue): JsonValue {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sortObjectKeys(item));
  }
  
  const sorted: JsonObject = {};
  Object.keys(obj)
    .sort()
    .forEach(key => {
      sorted[key] = sortObjectKeys((obj as JsonObject)[key]);
    });
  
  return sorted;
}
