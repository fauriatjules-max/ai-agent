/**
 * Core JSON types
 */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export interface JsonArray extends Array<JsonValue> {}

/**
 * JSON Path types
 */
export interface JsonPathResult {
  value: JsonValue | undefined;
  parent: JsonObject | JsonArray | null;
  key: string | number;
  exists: boolean;
  target: JsonValue;
}

export interface JsonPathOptions {
  create?: boolean;
  delete?: boolean;
  value?: JsonValue;
  multiple?: boolean;
}

/**
 * JSON Comparison types
 */
export interface JsonCompareResult {
  equal: boolean;
  differences: JsonDifference[];
  similarity: number;
}

export interface JsonDifference {
  path: string;
  type: string;
  valueA?: JsonValue;
  valueB?: JsonValue;
  detail?: string;
}

/**
 * JSON Merge types
 */
export type MergeStrategy = 'deep' | 'shallow' | 'replace' | 'overwrite' | 'custom';

export interface JsonMergeOptions {
  strategy?: MergeStrategy;
  arrayStrategy?: 'concat' | 'union' | 'intersection' | 'replace' | 'deep';
  conflictStrategy?: 'target' | 'source' | 'throw' | 'priority';
  customMerge?: (key: string, targetValue: any, sourceValue: any) => any;
  maxDepth?: number;
}

/**
 * JSON Validation types
 */
export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  enum?: any[];
  const?: any;
  additionalProperties?: boolean | JsonSchema;
  minProperties?: number;
  maxProperties?: number;
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  not?: JsonSchema;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  value?: any;
  expected?: any;
}

/**
 * JSON Transformation types
 */
export interface JsonTransformOptions {
  rules?: JsonTransformRule[];
  mapFunction?: (value: JsonValue, path: string) => JsonValue;
  filterFunction?: (value: JsonValue, path: string) => boolean;
  defaultValue?: JsonValue;
  deep?: boolean;
  inPlace?: boolean;
}

export interface JsonTransformRule {
  path: string;
  operation: 'set' | 'delete' | 'rename' | 'transform';
  value?: JsonValue | string | ((value: JsonValue, path: string) => JsonValue);
  condition?: (value: JsonValue) => boolean | any;
}

/**
 * JSON Generation types
 */
export interface JsonGeneratorOptions {
  strict?: boolean;
  defaultValue?: JsonValue;
  validate?: boolean;
  validationSchema?: JsonSchema;
  onError?: 'throw' | 'default' | 'ignore';
}

export type JsonTemplate = JsonObject | JsonArray | TemplateDirective;

export interface TemplateDirective {
  $type: string;
  [key: string]: any;
}

export interface JsonTemplateConfig {
  type: 'object' | 'array';
  fields: Record<string, any> | any[];
  options?: {
    count?: number;
    [key: string]: any;
  };
}

/**
 * JSON Extraction types
 */
export interface JsonExtractOptions {
  defaultValue?: JsonValue;
  flatten?: boolean;
  includeMissing?: boolean;
  transform?: (value: JsonValue, pattern: string, alias?: string) => JsonValue;
}

export interface JsonPathPattern {
  pattern: string;
  alias?: string;
  filter?: (value: JsonValue, path: string) => boolean;
}

/**
 * Parser and Stringifier types
 */
export interface JsonParseOptions {
  reviver?: (key: string, value: any) => any;
  strict?: boolean;
}

export interface JsonStringifyOptions {
  replacer?: (string | number)[] | null;
  space?: string | number;
  circularReferenceHandler?: (key: string, value: any) => any;
}

/**
 * Error types
 */
export interface JsonError extends Error {
  path?: string;
  value?: any;
  expected?: any;
}

/**
 * Utility types
 */
export interface KeyValuePair {
  key: string;
  value: JsonValue;
}

export interface GroupedResult {
  [key: string]: JsonValue[];
}

export interface FlattenOptions {
  delimiter?: string;
  prefix?: string;
  excludeKeys?: string[];
}

export interface SortOptions {
  key?: string;
  order?: 'asc' | 'desc';
  compareFunction?: (a: JsonValue, b: JsonValue) => number;
}

/**
 * Advanced transformation types
 */
export interface MapFunction {
  (value: JsonValue, path: string, index?: number): JsonValue;
}

export interface FilterFunction {
  (value: JsonValue, path: string, index?: number): boolean;
}

export interface ReduceFunction<T> {
  (accumulator: T, current: JsonValue, index: number): T;
}

/**
 * Pattern matching types
 */
export interface PatternMatch {
  pattern: string | RegExp;
  handler: (match: RegExpMatchArray, value: JsonValue) => JsonValue;
}

/**
 * Type guard functions
 */
export function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isJsonArray(value: JsonValue): value is JsonArray {
  return Array.isArray(value);
}

export function isJsonPrimitive(value: JsonValue): value is JsonPrimitive {
  return value === null || 
         typeof value === 'string' || 
         typeof value === 'number' || 
         typeof value === 'boolean';
}

export function isString(value: JsonValue): value is string {
  return typeof value === 'string';
}

export function isNumber(value: JsonValue): value is number {
  return typeof value === 'number';
}

export function isBoolean(value: JsonValue): value is boolean {
  return typeof value === 'boolean';
}

export function isNull(value: JsonValue): value is null {
  return value === null;
}

/**
 * Type conversion utilities
 */
export function asJsonObject(value: JsonValue): JsonObject | undefined {
  return isJsonObject(value) ? value : undefined;
}

export function asJsonArray(value: JsonValue): JsonArray | undefined {
  return isJsonArray(value) ? value : undefined;
}

export function asString(value: JsonValue): string | undefined {
  return isString(value) ? value : undefined;
}

export function asNumber(value: JsonValue): number | undefined {
  return isNumber(value) ? value : undefined;
}

export function asBoolean(value: JsonValue): boolean | undefined {
  return isBoolean(value) ? value : undefined;
}

/**
 * Constants
 */
export const JSON_TYPES = ['string', 'number', 'boolean', 'object', 'array', 'null'] as const;
export type JsonType = typeof JSON_TYPES[number];

export const MERGE_STRATEGIES = ['deep', 'shallow', 'replace', 'overwrite', 'custom'] as const;
export const ARRAY_STRATEGIES = ['concat', 'union', 'intersection', 'replace', 'deep'] as const;
export const CONFLICT_STRATEGIES = ['target', 'source', 'throw', 'priority'] as const;

/**
 * Template directive types
 */
export type TemplateDirectiveType = 
  | 'ref'        // Reference to data path
  | 'array'      // Generate array
  | 'object'     // Generate object
  | 'switch'     // Conditional generation
  | 'transform'  // Apply transformation
  | 'concat'     // Concatenate values
  | 'math'       // Mathematical operation
  | 'date'       // Date generation
  | 'random'     // Random value generation
  | 'literal';   // Literal value

export interface RefDirective extends TemplateDirective {
  $type: 'ref';
  $path: string;
  $default?: JsonValue;
}

export interface ArrayDirective extends TemplateDirective {
  $type: 'array';
  $items: JsonTemplate;
  $count?: number;
}

export interface ObjectDirective extends TemplateDirective {
  $type: 'object';
  $properties: Record<string, JsonTemplate>;
}

export interface SwitchDirective extends TemplateDirective {
  $type: 'switch';
  $cases: Array<{
    $condition: any;
    $value: JsonTemplate;
  }>;
  $default?: JsonTemplate;
}

export interface TransformDirective extends TemplateDirective {
  $type: 'transform';
  $source: JsonTemplate;
  $transform: (value: JsonValue, data: JsonObject) => JsonValue;
}

export interface ConcatDirective extends TemplateDirective {
  $type: 'concat';
  $parts: JsonTemplate[];
  $separator?: string;
}

export interface MathDirective extends TemplateDirective {
  $type: 'math';
  $operation: 'add' | 'subtract' | 'multiply' | 'divide' | 'modulo' | 'power';
  $operands: JsonTemplate[];
}

export interface DateDirective extends TemplateDirective {
  $type: 'date';
  $value?: 'now' | 'today' | string | number;
  $format?: 'iso' | 'date' | 'time' | 'timestamp' | 'custom';
  $customFormat?: string;
  $offset?: {
    years?: number;
    months?: number;
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
  };
}

export interface RandomDirective extends TemplateDirective {
  $type: 'random';
  $valueType: 'string' | 'number' | 'boolean' | 'date' | 'choice';
  $length?: number;
  $chars?: string;
  $min?: number;
  $max?: number;
  $integer?: boolean;
  $choices?: JsonValue[];
  $start?: string;
  $end?: string;
}

export interface LiteralDirective extends TemplateDirective {
  $type: 'literal';
  $value: JsonValue;
}

/**
 * Type guard for template directives
 */
export function isRefDirective(directive: any): directive is RefDirective {
  return directive && directive.$type === 'ref' && directive.$path;
}

export function isArrayDirective(directive: any): directive is ArrayDirective {
  return directive && directive.$type === 'array' && directive.$items;
}

export function isObjectDirective(directive: any): directive is ObjectDirective {
  return directive && directive.$type === 'object' && directive.$properties;
}

export function isSwitchDirective(directive: any): directive is SwitchDirective {
  return directive && directive.$type === 'switch' && Array.isArray(directive.$cases);
}

export function isTransformDirective(directive: any): directive is TransformDirective {
  return directive && directive.$type === 'transform' && directive.$source && directive.$transform;
}

export function isConcatDirective(directive: any): directive is ConcatDirective {
  return directive && directive.$type === 'concat' && Array.isArray(directive.$parts);
}

export function isMathDirective(directive: any): directive is MathDirective {
  return directive && directive.$type === 'math' && directive.$operation && Array.isArray(directive.$operands);
}

export function isDateDirective(directive: any): directive is DateDirective {
  return directive && directive.$type === 'date';
}

export function isRandomDirective(directive: any): directive is RandomDirective {
  return directive && directive.$type === 'random' && directive.$valueType;
}

export function isLiteralDirective(directive: any): directive is LiteralDirective {
  return directive && directive.$type === 'literal' && directive.$value !== undefined;
}

/**
 * JSON manipulation utilities
 */
export interface JsonManipulator {
  get: (path: string) => JsonValue | undefined;
  set: (path: string, value: JsonValue) => void;
  delete: (path: string) => void;
  has: (path: string) => boolean;
  paths: () => string[];
}

/**
 * JSON validation utilities
 */
export interface Validator {
  (value: JsonValue): ValidationResult;
  schema: JsonSchema;
}

/**
 * JSON transformation pipeline
 */
export interface TransformationPipeline {
  steps: Array<(value: JsonValue) => JsonValue>;
  process: (value: JsonValue) => JsonValue;
}

/**
 * JSON query interface
 */
export interface JsonQuery {
  where: (predicate: (value: JsonValue, path: string) => boolean) => JsonQuery;
  select: (paths: string[] | JsonPathPattern[]) => JsonQuery;
  orderBy: (key: string, order?: 'asc' | 'desc') => JsonQuery;
  limit: (count: number) => JsonQuery;
  get: () => JsonValue[];
  first: () => JsonValue | undefined;
}

/**
 * Event types for JSON operations
 */
export interface JsonEvent {
  type: string;
  path: string;
  value?: JsonValue;
  oldValue?: JsonValue;
  timestamp: number;
}

export interface JsonObserver {
  on(event: string, handler: (event: JsonEvent) => void): void;
  off(event: string, handler: (event: JsonEvent) => void): void;
}

/**
 * Performance metrics for JSON operations
 */
export interface JsonMetrics {
  operation: string;
  duration: number;
  size: number;
  memoryUsage: number;
  timestamp: number;
}

/**
 * Cache interface for JSON operations
 */
export interface JsonCache {
  set(key: string, value: JsonValue, ttl?: number): void;
  get(key: string): JsonValue | undefined;
  delete(key: string): void;
  clear(): void;
  has(key: string): boolean;
}
