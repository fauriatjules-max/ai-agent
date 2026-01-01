import { JsonValue, JsonObject, JsonArray, JsonTemplate, JsonGeneratorOptions } from './types/json.types';
import { parseJson, stringifyJson } from './json.parser';
import { validateJson } from './json.validator';
import { jsonPath, getValue } from './json.path';

export class JsonGeneratorError extends Error {
  constructor(
    message: string,
    public template?: any,
    public data?: any
  ) {
    super(message);
    this.name = 'JsonGeneratorError';
  }
}

/**
 * Generate JSON from a template with data binding
 */
export function generateJson(
  template: JsonTemplate | JsonArray,
  data?: JsonObject,
  options: JsonGeneratorOptions = {}
): JsonValue {
  const {
    strict = false,
    defaultValue = null,
    validate = false,
    validationSchema,
    onError = 'throw'
  } = options;

  try {
    // Deep clone the template
    let result = deepCloneTemplate(template);
    
    // Process the template with data if provided
    if (data !== undefined) {
      result = processTemplate(result, data, {
        strict,
        defaultValue
      });
    }

    // Validate the result if requested
    if (validate) {
      const validationResult = validateJson(result, validationSchema || {});
      if (!validationResult.valid && strict) {
        throw new JsonGeneratorError(
          'Generated JSON failed validation',
          template,
          data
        );
      }
    }

    return result;
  } catch (error: any) {
    if (onError === 'throw') {
      if (error instanceof JsonGeneratorError) {
        throw error;
      }
      throw new JsonGeneratorError(
        `Failed to generate JSON: ${error.message}`,
        template,
        data
      );
    } else if (onError === 'default') {
      return defaultValue;
    } else {
      // onError === 'ignore'
      return template;
    }
  }
}

/**
 * Create a JSON template with placeholders
 */
export function createTemplate(
  structure: JsonObject | string[] | JsonTemplateConfig,
  type: 'object' | 'array' = 'object'
): JsonTemplate {
  if (Array.isArray(structure)) {
    if (type === 'array') {
      // Array of templates
      return structure.map(item => createTemplateItem(item));
    } else {
      // Object with keys from array
      const result: JsonObject = {};
      for (const key of structure) {
        result[key] = { type: 'any', optional: false };
      }
      return result;
    }
  } else if (typeof structure === 'object' && structure !== null) {
    // Already a template or config object
    if ('type' in structure && 'fields' in structure) {
      // It's a JsonTemplateConfig
      return createTemplateFromConfig(structure as JsonTemplateConfig);
    } else {
      // It's already a template object
      return structure as JsonTemplate;
    }
  }

  throw new JsonGeneratorError(
    'Invalid template structure',
    structure
  );
}

/**
 * Generate random JSON data based on schema
 */
export function generateRandomJson(
  schema: JsonObject,
  options: {
    count?: number;
    seed?: number;
    minItems?: number;
    maxItems?: number;
  } = {}
): JsonValue | JsonValue[] {
  const {
    count = 1,
    seed,
    minItems = 1,
    maxItems = 10
  } = options;

  // Set seed if provided
  if (seed !== undefined) {
    setRandomSeed(seed);
  }

  // Generate single or multiple items
  if (count === 1) {
    return generateRandomFromSchema(schema, minItems, maxItems);
  } else {
    const results: JsonValue[] = [];
    for (let i = 0; i < count; i++) {
      results.push(generateRandomFromSchema(schema, minItems, maxItems));
    }
    return results;
  }
}

/**
 * Generate JSON from CSV-like data
 */
export function generateFromTable(
  data: Array<Record<string, any>>,
  options: {
    groupBy?: string | string[];
    nest?: Record<string, string>;
    transform?: Record<string, (value: any) => any>;
  } = {}
): JsonValue {
  const { groupBy, nest, transform = {} } = options;

  // If no grouping, return array of objects
  if (!groupBy) {
    return data.map(row => transformRow(row, transform));
  }

  // Group by specified fields
  const groups = groupData(data, Array.isArray(groupBy) ? groupBy : [groupBy]);
  
  // Handle nesting if specified
  if (nest) {
    return applyNesting(groups, nest);
  }

  return groups;
}

/**
 * Generate JSON schema from data
 */
export function generateSchema(
  data: JsonValue,
  options: {
    inferTypes?: boolean;
    includeExamples?: boolean;
    depth?: number;
  } = {}
): JsonObject {
  const {
    inferTypes = true,
    includeExamples = false,
    depth = 10
  } = options;

  return inferSchemaFromData(data, {
    inferTypes,
    includeExamples,
    depth
  });
}

/**
 * Create a JSON template string with placeholders
 */
export function createTemplateString(
  template: string,
  data: JsonObject
): string {
  // Replace placeholders like {{key}} or {{path.to.value}}
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = getValue(data, path.trim());
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Generate JSON by merging multiple templates
 */
export function mergeTemplates(
  templates: JsonTemplate[],
  strategy: 'deep' | 'shallow' | 'union' = 'deep'
): JsonTemplate {
  if (templates.length === 0) {
    return {};
  }

  if (templates.length === 1) {
    return deepCloneTemplate(templates[0]);
  }

  let result = deepCloneTemplate(templates[0]);

  for (let i = 1; i < templates.length; i++) {
    result = mergeTwoTemplates(result, templates[i], strategy);
  }

  return result;
}

/**
 * Fill template with default values
 */
export function fillTemplate(
  template: JsonTemplate,
  defaults: JsonObject
): JsonValue {
  return processTemplate(template, defaults, {
    strict: false,
    defaultValue: null
  });
}

/**
 * Generate JSON diff between template and data
 */
export function generateDiff(
  template: JsonTemplate,
  data: JsonObject
): JsonObject {
  const generated = generateJson(template, data, { strict: false });
  
  // Compare template expectations with actual data
  const diff: JsonObject = {
    missing: [],
    extra: [],
    typeMismatches: [],
    valueMismatches: []
  };

  compareTemplateWithData(template, data, '', diff);

  return diff;
}

// Helper functions
function deepCloneTemplate(template: any): any {
  if (template === null || template === undefined) {
    return template;
  }

  if (Array.isArray(template)) {
    return template.map(item => deepCloneTemplate(item));
  }

  if (typeof template === 'object') {
    const result: JsonObject = {};
    for (const [key, value] of Object.entries(template)) {
      result[key] = deepCloneTemplate(value);
    }
    return result;
  }

  return template;
}

function processTemplate(
  template: any,
  data: JsonObject,
  options: {
    strict: boolean;
    defaultValue: any;
  }
): any {
  // If template is a string with placeholder syntax
  if (typeof template === 'string') {
    return processTemplateString(template, data, options);
  }

  // If template is an array
  if (Array.isArray(template)) {
    return template.map(item => processTemplate(item, data, options));
  }

  // If template is an object
  if (typeof template === 'object' && template !== null) {
    // Check if it's a template directive
    if (template.$type) {
      return processTemplateDirective(template, data, options);
    }

    // Regular object
    const result: JsonObject = {};
    for (const [key, value] of Object.entries(template)) {
      result[key] = processTemplate(value, data, options);
    }
    return result;
  }

  // Primitive value
  return template;
}

function processTemplateString(
  template: string,
  data: JsonObject,
  options: {
    strict: boolean;
    defaultValue: any;
  }
): any {
  // Check for simple placeholder: {{path}}
  const placeholderRegex = /\{\{([^}]+)\}\}/g;
  const matches = [...template.matchAll(placeholderRegex)];

  if (matches.length === 0) {
    // No placeholders, return string as-is
    return template;
  }

  if (matches.length === 1 && matches[0][0] === template) {
    // Entire template is a single placeholder
    const path = matches[0][1].trim();
    const value = getValue(data, path);
    
    if (value === undefined) {
      if (options.strict) {
        throw new JsonGeneratorError(
          `Missing data for path: ${path}`,
          template,
          data
        );
      }
      return options.defaultValue;
    }
    
    return value;
  }

  // Multiple placeholders, replace each one
  let result = template;
  for (const match of matches) {
    const [fullMatch, path] = match;
    const value = getValue(data, path.trim());
    
    if (value === undefined) {
      if (options.strict) {
        throw new JsonGeneratorError(
          `Missing data for path: ${path}`,
          template,
          data
        );
      }
      result = result.replace(fullMatch, String(options.defaultValue));
    } else {
      result = result.replace(fullMatch, String(value));
    }
  }
  
  return result;
}

function processTemplateDirective(
  directive: any,
  data: JsonObject,
  options: {
    strict: boolean;
    defaultValue: any;
  }
): any {
  const type = directive.$type;
  
  switch (type) {
    case 'ref':
      // Reference to data path
      const path = directive.$path;
      if (!path) {
        throw new JsonGeneratorError('Missing $path in $type:ref directive', directive);
      }
      
      const value = getValue(data, path);
      if (value === undefined) {
        if (options.strict) {
          throw new JsonGeneratorError(
            `Missing data for path: ${path}`,
            directive,
            data
          );
        }
        return directive.$default !== undefined ? directive.$default : options.defaultValue;
      }
      return value;
    
    case 'array':
      // Generate array
      const items = directive.$items;
      const count = directive.$count;
      
      if (items && count) {
        // Generate array with specified count
        const result: JsonArray = [];
        for (let i = 0; i < count; i++) {
          const itemData = { ...data, $index: i, $count: count };
          result.push(processTemplate(items, itemData, options));
        }
        return result;
      } else if (items) {
        // Single item or array template
        return processTemplate(items, data, options);
      }
      return [];
    
    case 'object':
      // Generate object
      const properties = directive.$properties;
      if (properties && typeof properties === 'object') {
        return processTemplate(properties, data, options);
      }
      return {};
    
    case 'switch':
      // Conditional generation
      const cases = directive.$cases;
      const defaultCase = directive.$default;
      
      if (cases && Array.isArray(cases)) {
        for (const caseItem of cases) {
          const condition = caseItem.$condition;
          const value = caseItem.$value;
          
          if (evaluateCondition(condition, data)) {
            return processTemplate(value, data, options);
          }
        }
      }
      
      if (defaultCase !== undefined) {
        return processTemplate(defaultCase, data, options);
      }
      
      return options.defaultValue;
    
    case 'transform':
      // Apply transformation
      const source = directive.$source;
      const transform = directive.$transform;
      
      if (source && transform && typeof transform === 'function') {
        const sourceValue = processTemplate(source, data, options);
        return transform(sourceValue, data);
      }
      return options.defaultValue;
    
    case 'concat':
      // Concatenate values
      const parts = directive.$parts;
      if (parts && Array.isArray(parts)) {
        const processedParts = parts.map(part => 
          String(processTemplate(part, data, options))
        );
        return processedParts.join(directive.$separator || '');
      }
      return '';
    
    case 'math':
      // Mathematical operation
      return evaluateMathOperation(directive, data, options);
    
    case 'date':
      // Date generation
      return generateDate(directive, data);
    
    case 'random':
      // Random value generation
      return generateRandomValue(directive);
    
    default:
      throw new JsonGeneratorError(`Unknown template directive: ${type}`, directive);
  }
}

function evaluateCondition(condition: any, data: JsonObject): boolean {
  if (typeof condition === 'function') {
    return condition(data);
  }
  
  if (typeof condition === 'string') {
    // Simple expression like "age > 18"
    try {
      // Create a safe evaluation context
      const context = { ...data, $: data };
      const expr = condition
        .replace(/(\w+)/g, (match: string) => {
          if (match in context) return `context.${match}`;
          return match;
        });
      
      // eslint-disable-next-line no-eval
      return eval(`(${expr})`);
    } catch {
      return false;
    }
  }
  
  return Boolean(condition);
}

function evaluateMathOperation(
  directive: any,
  data: JsonObject,
  options: {
    strict: boolean;
    defaultValue: any;
  }
): number {
  const operation = directive.$operation;
  const operands = directive.$operands || [];
  
  const processedOperands = operands.map((operand: any) => {
    const value = processTemplate(operand, data, options);
    return typeof value === 'number' ? value : parseFloat(value) || 0;
  });
  
  switch (operation) {
    case 'add':
      return processedOperands.reduce((sum: number, val: number) => sum + val, 0);
    case 'subtract':
      return processedOperands.length >= 2 
        ? processedOperands[0] - processedOperands.slice(1).reduce((sum, val) => sum + val, 0)
        : processedOperands[0] || 0;
    case 'multiply':
      return processedOperands.reduce((product: number, val: number) => product * val, 1);
    case 'divide':
      return processedOperands.length >= 2 
        ? processedOperands[0] / processedOperands.slice(1).reduce((product, val) => product * val, 1)
        : processedOperands[0] || 0;
    case 'modulo':
      return processedOperands.length >= 2 
        ? processedOperands[0] % processedOperands[1]
        : processedOperands[0] || 0;
    case 'power':
      return processedOperands.length >= 2 
        ? Math.pow(processedOperands[0], processedOperands[1])
        : processedOperands[0] || 0;
    default:
      throw new JsonGeneratorError(`Unknown math operation: ${operation}`, directive);
  }
}

function generateDate(directive: any, data: JsonObject): string {
  const format = directive.$format || 'iso';
  const value = directive.$value;
  
  let date: Date;
  
  if (value === 'now') {
    date = new Date();
  } else if (value === 'today') {
    date = new Date();
    date.setHours(0, 0, 0, 0);
  } else if (typeof value === 'string') {
    // Parse date string
    date = new Date(value);
  } else if (typeof value === 'number') {
    // Unix timestamp
    date = new Date(value * 1000);
  } else {
    date = new Date();
  }
  
  // Apply offset if specified
  if (directive.$offset) {
    const offset = directive.$offset;
    if (offset.years) date.setFullYear(date.getFullYear() + offset.years);
    if (offset.months) date.setMonth(date.getMonth() + offset.months);
    if (offset.days) date.setDate(date.getDate() + offset.days);
    if (offset.hours) date.setHours(date.getHours() + offset.hours);
    if (offset.minutes) date.setMinutes(date.getMinutes() + offset.minutes);
    if (offset.seconds) date.setSeconds(date.getSeconds() + offset.seconds);
  }
  
  // Format the date
  switch (format) {
    case 'iso':
      return date.toISOString();
    case 'date':
      return date.toISOString().split('T')[0];
    case 'time':
      return date.toISOString().split('T')[1].split('.')[0];
    case 'timestamp':
      return Math.floor(date.getTime() / 1000).toString();
    case 'custom':
      const customFormat = directive.$customFormat || 'YYYY-MM-DD';
      return formatCustomDate(date, customFormat);
    default:
      return date.toISOString();
  }
}

function generateRandomValue(directive: any): any {
  const type = directive.$valueType || 'string';
  
  switch (type) {
    case 'string':
      const length = directive.$length || 10;
      const chars = directive.$chars || 'abcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    
    case 'number':
      const min = directive.$min || 0;
      const max = directive.$max || 100;
      const integer = directive.$integer !== false;
      
      const num = min + Math.random() * (max - min);
      return integer ? Math.floor(num) : parseFloat(num.toFixed(2));
    
    case 'boolean':
      return Math.random() > 0.5;
    
    case 'date':
      const start = directive.$start ? new Date(directive.$start).getTime() : Date.now() - 365 * 24 * 60 * 60 * 1000;
      const end = directive.$end ? new Date(directive.$end).getTime() : Date.now();
      const randomTime = start + Math.random() * (end - start);
      return new Date(randomTime).toISOString();
    
    case 'choice':
      const choices = directive.$choices || [];
      if (choices.length === 0) return null;
      return choices[Math.floor(Math.random() * choices.length)];
    
    default:
      return null;
  }
}

function createTemplateItem(item: any): JsonTemplate {
  if (typeof item === 'string') {
    return { $type: 'ref', $path: item };
  }
  
  if (typeof item === 'object' && item !== null) {
    // Already a template
    return item;
  }
  
  return { $type: 'literal', $value: item };
}

function createTemplateFromConfig(config: JsonTemplateConfig): JsonTemplate {
  const { type, fields, options = {} } = config;
  
  if (type === 'object') {
    const template: JsonObject = {};
    for (const [fieldName, fieldConfig] of Object.entries(fields)) {
      template[fieldName] = createFieldTemplate(fieldConfig);
    }
    return template;
  }
  
  if (type === 'array') {
    return {
      $type: 'array',
      $items: Array.isArray(fields) ? fields.map(createFieldTemplate) : createFieldTemplate(fields),
      $count: options.count
    };
  }
  
  throw new JsonGeneratorError(`Unknown template type: ${type}`, config);
}

function createFieldTemplate(fieldConfig: any): any {
  if (typeof fieldConfig === 'string') {
    return { $type: 'ref', $path: fieldConfig };
  }
  
  if (typeof fieldConfig === 'object' && fieldConfig !== null) {
    if (fieldConfig.type) {
      // It's a field configuration object
      const result: any = { $type: fieldConfig.type };
      
      if (fieldConfig.source) result.$source = fieldConfig.source;
      if (fieldConfig.default) result.$default = fieldConfig.default;
      if (fieldConfig.transform) result.$transform = fieldConfig.transform;
      if (fieldConfig.options) Object.assign(result, fieldConfig.options);
      
      return result;
    }
    
    // Already a template directive
    return fieldConfig;
  }
  
  // Literal value
  return fieldConfig;
}

function generateRandomFromSchema(
  schema: JsonObject,
  minItems: number,
  maxItems: number
): JsonValue {
  const result: JsonObject = {};
  
  for (const [key, fieldSchema] of Object.entries(schema)) {
    if (typeof fieldSchema === 'object' && fieldSchema !== null) {
      if (fieldSchema.type === 'array' && fieldSchema.items) {
        // Generate array
        const count = Math.floor(minItems + Math.random() * (maxItems - minItems + 1));
        const items: JsonArray = [];
        for (let i = 0; i < count; i++) {
          items.push(generateRandomFromSchema(fieldSchema.items as JsonObject, 1, 5));
        }
        result[key] = items;
      } else if (fieldSchema.type === 'object' && fieldSchema.properties) {
        // Generate nested object
        result[key] = generateRandomFromSchema(fieldSchema.properties as JsonObject, minItems, maxItems);
      } else {
        // Generate primitive based on type
        result[key] = generateRandomPrimitive(fieldSchema);
      }
    } else {
      // Simple field, generate random value
      result[key] = generateRandomPrimitive({ type: 'string' });
    }
  }
  
  return result;
}

function generateRandomPrimitive(schema: any): any {
  const type = schema.type || 'string';
  
  switch (type) {
    case 'string':
      if (schema.enum && Array.isArray(schema.enum)) {
        return schema.enum[Math.floor(Math.random() * schema.enum.length)];
      }
      return Math.random().toString(36).substring(2, 10);
    
    case 'number':
    case 'integer':
      const min = schema.minimum || 0;
      const max = schema.maximum || 100;
      const num = min + Math.random() * (max - min);
      return type === 'integer' ? Math.floor(num) : parseFloat(num.toFixed(2));
    
    case 'boolean':
      return Math.random() > 0.5;
    
    case 'null':
      return null;
    
    default:
      return null;
  }
}

function groupData(
  data: Array<Record<string, any>>,
  groupBy: string[]
): JsonObject {
  const groups: JsonObject = {};
  
  for (const row of data) {
    let currentLevel: any = groups;
    
    // Navigate through groupBy hierarchy
    for (let i = 0; i < groupBy.length - 1; i++) {
      const key = groupBy[i];
      const value = row[key];
      const valueKey = String(value);
      
      if (!currentLevel[valueKey]) {
        currentLevel[valueKey] = {};
      }
      currentLevel = currentLevel[valueKey];
    }
    
    // Last level: add the row
    const lastKey = groupBy[groupBy.length - 1];
    const lastValue = row[lastKey];
    const lastValueKey = String(lastValue);
    
    if (!currentLevel[lastValueKey]) {
      currentLevel[lastValueKey] = [];
    }
    (currentLevel[lastValueKey] as JsonArray).push(row);
  }
  
  return groups;
}

function applyNesting(
  data: JsonObject,
  nestConfig: Record<string, string>
): JsonObject {
  const result: JsonObject = {};
  
  for (const [key, value] of Object.entries(data)) {
    const nestPath = nestConfig[key];
    
    if (nestPath) {
      // Create nested structure
      const pathParts = nestPath.split('.');
      let current = result;
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part] as JsonObject;
      }
      
      const lastPart = pathParts[pathParts.length - 1];
      current[lastPart] = value;
    } else {
      // Keep as-is
      result[key] = value;
    }
  }
  
  return result;
}

function transformRow(
  row: Record<string, any>,
  transforms: Record<string, (value: any) => any>
): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(row)) {
    if (transforms[key]) {
      result[key] = transforms[key](value);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

function inferSchemaFromData(
  data: JsonValue,
  options: {
    inferTypes: boolean;
    includeExamples: boolean;
    depth: number;
  },
  currentDepth: number = 0
): JsonObject {
  if (currentDepth > options.depth) {
    return { type: 'any' };
  }
  
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return { type: 'array', items: { type: 'any' } };
    }
    
    // Infer schema from first item
    const itemSchema = inferSchemaFromData(data[0], options, currentDepth + 1);
    
    const schema: JsonObject = {
      type: 'array',
      items: itemSchema
    };
    
    if (options.includeExamples) {
      schema.examples = data.slice(0, 3);
    }
    
    return schema;
  }
  
  if (typeof data === 'object' && data !== null) {
    const schema: JsonObject = {
      type: 'object',
      properties: {}
    };
    
    for (const [key, value] of Object.entries(data)) {
      (schema.properties as JsonObject)[key] = inferSchemaFromData(
        value,
        options,
        currentDepth + 1
      );
    }
    
    if (options.includeExamples) {
      schema.example = data;
    }
    
    return schema;
  }
  
  // Primitive value
  const schema: JsonObject = { type: getTypeName(data) };
  
  if (options.includeExamples) {
    schema.example = data;
  }
  
  return schema;
}

function getTypeName(value: any): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function setRandomSeed(seed: number): void {
  // Simple seedable random function
  let currentSeed = seed;
  
  Math.random = () => {
    const x = Math.sin(currentSeed++) * 10000;
    return x - Math.floor(x);
  };
}

function mergeTwoTemplates(
  template1: any,
  template2: any,
  strategy: string
): any {
  if (Array.isArray(template1) && Array.isArray(template2)) {
    if (strategy === 'union') {
      // Remove duplicates
      const combined = [...template1, ...template2];
      const seen = new Set();
      return combined.filter(item => {
        const key = JSON.stringify(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    return [...template1, ...template2];
  }
  
  if (typeof template1 === 'object' && template1 !== null &&
      typeof template2 === 'object' && template2 !== null) {
    
    if (strategy === 'shallow') {
      return { ...template1, ...template2 };
    }
    
    // Deep merge
    const result = { ...template1 };
    
    for (const [key, value2] of Object.entries(template2)) {
      if (key in result) {
        result[key] = mergeTwoTemplates(result[key], value2, strategy);
      } else {
        result[key] = value2;
      }
    }
    
    return result;
  }
  
  // Primitives or different types
  return template2;
}

function compareTemplateWithData(
  template: any,
  data: JsonObject,
  path: string,
  diff: JsonObject
): void {
  if (template && typeof template === 'object' && template.$type) {
    // Template directive
    if (template.$type === 'ref' && template.$path) {
      const value = getValue(data, template.$path);
      if (value === undefined) {
        (diff.missing as string[]).push(path || template.$path);
      }
    }
    return;
  }
  
  if (Array.isArray(template)) {
    for (let i = 0; i < template.length; i++) {
      compareTemplateWithData(template[i], data, `${path}[${i}]`, diff);
    }
  } else if (typeof template === 'object' && template !== null) {
    for (const [key, value] of Object.entries(template)) {
      compareTemplateWithData(value, data, path ? `${path}.${key}` : key, diff);
    }
  }
}

function formatCustomDate(date: Date, format: string): string {
  const replacements: Record<string, string> = {
    'YYYY': date.getFullYear().toString(),
    'YY': date.getFullYear().toString().slice(-2),
    'MM': String(date.getMonth() + 1).padStart(2, '0'),
    'M': String(date.getMonth() + 1),
    'DD': String(date.getDate()).padStart(2, '0'),
    'D': String(date.getDate()),
    'HH': String(date.getHours()).padStart(2, '0'),
    'H': String(date.getHours()),
    'mm': String(date.getMinutes()).padStart(2, '0'),
    'm': String(date.getMinutes()),
    'ss': String(date.getSeconds()).padStart(2, '0'),
    's': String(date.getSeconds()),
  };
  
  return format.replace(/YYYY|YY|MM|M|DD|D|HH|H|mm|m|ss|s/g, match => replacements[match]);
}
