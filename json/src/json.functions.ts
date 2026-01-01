import { 
  JsonObject, 
  JsonArray, 
  JsonValue, 
  JsonPathResult,
  JsonMergeOptions,
  JsonCompareResult,
  JsonTransformOptions 
} from './types/json.types';
import { parseJson, stringifyJson } from './json.parser';
import { validateJson, validateSchema } from './json.validator';
import { 
  transformJson, 
  mapJson, 
  filterJson, 
  reduceJson,
  flattenJson,
  unflattenJson 
} from './json.transformer';
import { jsonPath } from './json.path';
import { compareJson, deepEqual, findDifferences } from './json.compare';
import { mergeJson, deepMerge } from './json.merge';
import { extractValues, extractByPath } from './json.extract';
import { generateJson, createTemplate } from './json.generate';

export class JsonFunctions {
  
  // Parsing and Serialization
  static parse<T = JsonValue>(jsonString: string, reviver?: (key: string, value: any) => any): T {
    return parseJson(jsonString, reviver);
  }

  static stringify(value: JsonValue, replacer?: (string | number)[] | null, space?: string | number): string {
    return stringifyJson(value, replacer, space);
  }

  static safeParse<T = JsonValue>(jsonString: string, defaultValue?: T): T | null {
    try {
      return parseJson(jsonString);
    } catch {
      return defaultValue || null;
    }
  }

  // Validation
  static validate(json: JsonValue): boolean {
    return validateJson(json);
  }

  static validateSchema(json: JsonValue, schema: any): boolean {
    return validateSchema(json, schema);
  }

  // Transformation
  static transform<T = JsonValue>(json: JsonValue, options: JsonTransformOptions): T {
    return transformJson(json, options);
  }

  static map<T = JsonValue>(json: JsonArray, callback: (item: JsonValue, index: number) => JsonValue): JsonArray {
    return mapJson(json, callback);
  }

  static filter(json: JsonArray, predicate: (item: JsonValue, index: number) => boolean): JsonArray {
    return filterJson(json, predicate);
  }

  static reduce<T = JsonValue>(
    json: JsonArray, 
    reducer: (accumulator: T, current: JsonValue, index: number) => T, 
    initialValue: T
  ): T {
    return reduceJson(json, reducer, initialValue);
  }

  static flatten(json: JsonObject, delimiter: string = '.'): JsonObject {
    return flattenJson(json, delimiter);
  }

  static unflatten(json: JsonObject, delimiter: string = '.'): JsonObject {
    return unflattenJson(json, delimiter);
  }

  // Path Operations
  static get(json: JsonValue, path: string): JsonPathResult {
    return jsonPath(json, path);
  }

  static set(json: JsonValue, path: string, value: JsonValue): JsonValue {
    const result = jsonPath(json, path, { create: true, value });
    return result.target;
  }

  static delete(json: JsonValue, path: string): JsonValue {
    jsonPath(json, path, { delete: true });
    return json;
  }

  // Comparison
  static compare(a: JsonValue, b: JsonValue): JsonCompareResult {
    return compareJson(a, b);
  }

  static deepEqual(a: JsonValue, b: JsonValue): boolean {
    return deepEqual(a, b);
  }

  static diff(a: JsonValue, b: JsonValue): JsonObject {
    return findDifferences(a, b);
  }

  // Merging
  static merge(target: JsonValue, ...sources: JsonValue[]): JsonValue {
    return mergeJson(target, ...sources);
  }

  static deepMerge(target: JsonObject, source: JsonObject, options?: JsonMergeOptions): JsonObject {
    return deepMerge(target, source, options);
  }

  // Extraction
  static extract(json: JsonValue, paths: string[]): JsonObject {
    return extractValues(json, paths);
  }

  static extractByPath(json: JsonValue, path: string): JsonValue | JsonValue[] {
    return extractByPath(json, path);
  }

  // Generation
  static generate(template: JsonObject | JsonArray, data?: JsonObject): JsonValue {
    return generateJson(template, data);
  }

  static createTemplate(keys: string[], type: 'object' | 'array' = 'object'): JsonObject | JsonArray {
    return createTemplate(keys, type);
  }

  // Utility Functions
  static clone<T = JsonValue>(json: T): T {
    return parseJson(stringifyJson(json));
  }

  static isEmpty(json: JsonValue): boolean {
    if (json === null || json === undefined) return true;
    if (Array.isArray(json)) return json.length === 0;
    if (typeof json === 'object') return Object.keys(json).length === 0;
    return false;
  }

  static size(json: JsonValue): number {
    if (Array.isArray(json)) return json.length;
    if (typeof json === 'object' && json !== null) return Object.keys(json).length;
    return 1;
  }

  static keys(json: JsonObject): string[] {
    return Object.keys(json);
  }

  static values(json: JsonObject | JsonArray): JsonValue[] {
    if (Array.isArray(json)) return [...json];
    return Object.values(json);
  }

  static entries(json: JsonObject): [string, JsonValue][] {
    return Object.entries(json);
  }

  static fromEntries(entries: [string, JsonValue][]): JsonObject {
    return Object.fromEntries(entries);
  }

  static pluck(jsonArray: JsonArray, key: string): JsonValue[] {
    return jsonArray.map(item => 
      typeof item === 'object' && item !== null ? item[key] : undefined
    ).filter(val => val !== undefined);
  }

  static groupBy(jsonArray: JsonArray, key: string): JsonObject {
    return jsonArray.reduce((groups: JsonObject, item) => {
      if (typeof item === 'object' && item !== null) {
        const groupKey = String(item[key]);
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        (groups[groupKey] as JsonArray).push(item);
      }
      return groups;
    }, {});
  }

  static sortBy(jsonArray: JsonArray, key: string, order: 'asc' | 'desc' = 'asc'): JsonArray {
    return [...jsonArray].sort((a, b) => {
      const aVal = typeof a === 'object' && a !== null ? a[key] : a;
      const bVal = typeof b === 'object' && b !== null ? b[key] : b;
      
      if (aVal === bVal) return 0;
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      
      const comparison = aVal < bVal ? -1 : 1;
      return order === 'asc' ? comparison : -comparison;
    });
  }

  static unique(jsonArray: JsonArray): JsonArray {
    const seen = new Set();
    return jsonArray.filter(item => {
      const key = stringifyJson(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Type Checking
  static isObject(value: JsonValue): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  static isArray(value: JsonValue): value is JsonArray {
    return Array.isArray(value);
  }

  static isPrimitive(value: JsonValue): boolean {
    return value === null || 
           value === undefined || 
           typeof value === 'string' || 
           typeof value === 'number' || 
           typeof value === 'boolean';
  }

  static getType(value: JsonValue): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }
}
