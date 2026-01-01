import { JsonValue, JsonObject, JsonArray, JsonSchema } from './types/json.types';

export class JsonValidationError extends Error {
  constructor(
    message: string,
    public path: string = '',
    public value?: any,
    public expected?: any
  ) {
    super(message);
    this.name = 'JsonValidationError';
  }
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
 * Validate JSON structure and content
 */
export function validateJson(
  json: JsonValue,
  options: {
    schema?: JsonSchema;
    requiredFields?: string[];
    allowedFields?: string[];
    typeConstraints?: Record<string, string>;
    valueConstraints?: Record<string, any>;
  } = {}
): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate against schema if provided
  if (options.schema) {
    const schemaErrors = validateAgainstSchema(json, options.schema);
    errors.push(...schemaErrors);
  }

  // Validate required fields for objects
  if (options.requiredFields && Array.isArray(options.requiredFields)) {
    if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
      for (const field of options.requiredFields) {
        if (!(field in json)) {
          errors.push({
            path: field,
            message: `Required field "${field}" is missing`,
            expected: 'present'
          });
        }
      }
    }
  }

  // Validate allowed fields for objects
  if (options.allowedFields && Array.isArray(options.allowedFields)) {
    if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
      const obj = json as JsonObject;
      for (const field of Object.keys(obj)) {
        if (!options.allowedFields.includes(field)) {
          errors.push({
            path: field,
            message: `Field "${field}" is not allowed`,
            value: obj[field],
            expected: 'undefined'
          });
        }
      }
    }
  }

  // Validate type constraints
  if (options.typeConstraints && typeof options.typeConstraints === 'object') {
    if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
      const obj = json as JsonObject;
      for (const [field, expectedType] of Object.entries(options.typeConstraints)) {
        if (field in obj) {
          const actualType = getTypeName(obj[field]);
          if (actualType !== expectedType) {
            errors.push({
              path: field,
              message: `Field "${field}" has type "${actualType}", expected "${expectedType}"`,
              value: obj[field],
              expected: expectedType
            });
          }
        }
      }
    }
  }

  // Validate value constraints
  if (options.valueConstraints && typeof options.valueConstraints === 'object') {
    if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
      const obj = json as JsonObject;
      for (const [field, constraint] of Object.entries(options.valueConstraints)) {
        if (field in obj) {
          const value = obj[field];
          if (!checkConstraint(value, constraint)) {
            errors.push({
              path: field,
              message: `Field "${field}" value "${value}" does not meet constraint`,
              value,
              expected: constraint
            });
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate JSON against a schema
 */
export function validateSchema(
  json: JsonValue,
  schema: JsonSchema
): ValidationResult {
  const errors = validateAgainstSchema(json, schema);
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if JSON matches a schema
 */
export function matchesSchema(json: JsonValue, schema: JsonSchema): boolean {
  const result = validateAgainstSchema(json, schema);
  return result.length === 0;
}

/**
 * Validate JSON array structure
 */
export function validateArray(
  jsonArray: JsonValue,
  options: {
    minLength?: number;
    maxLength?: number;
    itemSchema?: JsonSchema;
    unique?: boolean;
    allowedTypes?: string[];
  } = {}
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!Array.isArray(jsonArray)) {
    errors.push({
      path: '',
      message: 'Value is not an array',
      value: jsonArray,
      expected: 'array'
    });
    return { valid: false, errors };
  }

  const array = jsonArray as JsonArray;

  // Validate length constraints
  if (options.minLength !== undefined && array.length < options.minLength) {
    errors.push({
      path: '',
      message: `Array length ${array.length} is less than minimum ${options.minLength}`,
      value: array.length,
      expected: `>= ${options.minLength}`
    });
  }

  if (options.maxLength !== undefined && array.length > options.maxLength) {
    errors.push({
      path: '',
      message: `Array length ${array.length} exceeds maximum ${options.maxLength}`,
      value: array.length,
      expected: `<= ${options.maxLength}`
    });
  }

  // Validate item types
  if (options.allowedTypes && Array.isArray(options.allowedTypes)) {
    for (let i = 0; i < array.length; i++) {
      const itemType = getTypeName(array[i]);
      if (!options.allowedTypes.includes(itemType)) {
        errors.push({
          path: `[${i}]`,
          message: `Array item at index ${i} has type "${itemType}", allowed types: ${options.allowedTypes.join(', ')}`,
          value: array[i],
          expected: options.allowedTypes
        });
      }
    }
  }

  // Validate item schema
  if (options.itemSchema) {
    for (let i = 0; i < array.length; i++) {
      const itemErrors = validateAgainstSchema(array[i], options.itemSchema, `[${i}]`);
      errors.push(...itemErrors);
    }
  }

  // Check for uniqueness
  if (options.unique) {
    const seen = new Set();
    for (let i = 0; i < array.length; i++) {
      const key = JSON.stringify(array[i]);
      if (seen.has(key)) {
        errors.push({
          path: `[${i}]`,
          message: `Duplicate item found at index ${i}`,
          value: array[i],
          expected: 'unique value'
        });
      }
      seen.add(key);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate JSON object structure
 */
export function validateObject(
  jsonObject: JsonValue,
  options: {
    strict?: boolean;
    schema?: JsonSchema;
    propertySchemas?: Record<string, JsonSchema>;
    additionalProperties?: boolean;
  } = {}
): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof jsonObject !== 'object' || jsonObject === null || Array.isArray(jsonObject)) {
    errors.push({
      path: '',
      message: 'Value is not an object',
      value: jsonObject,
      expected: 'object'
    });
    return { valid: false, errors };
  }

  const obj = jsonObject as JsonObject;

  // Validate against schema
  if (options.schema) {
    const schemaErrors = validateAgainstSchema(obj, options.schema);
    errors.push(...schemaErrors);
  }

  // Validate property schemas
  if (options.propertySchemas && typeof options.propertySchemas === 'object') {
    for (const [property, schema] of Object.entries(options.propertySchemas)) {
      if (property in obj) {
        const propertyErrors = validateAgainstSchema(obj[property], schema, property);
        errors.push(...propertyErrors);
      }
    }
  }

  // Check for additional properties in strict mode
  if (options.strict && options.propertySchemas) {
    const allowedProperties = Object.keys(options.propertySchemas);
    for (const property of Object.keys(obj)) {
      if (!allowedProperties.includes(property)) {
        errors.push({
          path: property,
          message: `Additional property "${property}" is not allowed in strict mode`,
          value: obj[property],
          expected: 'undefined'
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate JSON value type
 */
export function validateType(
  value: JsonValue,
  expectedType: string | string[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const actualType = getTypeName(value);
  const expectedTypes = Array.isArray(expectedType) ? expectedType : [expectedType];

  if (!expectedTypes.includes(actualType)) {
    errors.push({
      path: '',
      message: `Value has type "${actualType}", expected ${expectedTypes.join(' or ')}`,
      value,
      expected: expectedTypes
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate JSON value against constraints
 */
export function validateValue(
  value: JsonValue,
  constraints: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    enum?: any[];
    format?: 'email' | 'url' | 'date' | 'date-time' | 'uuid';
    custom?: (val: any) => boolean;
  }
): ValidationResult {
  const errors: ValidationError[] = [];

  // Numeric constraints
  if (constraints.min !== undefined && typeof value === 'number') {
    if (value < constraints.min) {
      errors.push({
        path: '',
        message: `Value ${value} is less than minimum ${constraints.min}`,
        value,
        expected: `>= ${constraints.min}`
      });
    }
  }

  if (constraints.max !== undefined && typeof value === 'number') {
    if (value > constraints.max) {
      errors.push({
        path: '',
        message: `Value ${value} exceeds maximum ${constraints.max}`,
        value,
        expected: `<= ${constraints.max}`
      });
    }
  }

  // Pattern constraint for strings
  if (constraints.pattern && typeof value === 'string') {
    if (!constraints.pattern.test(value)) {
      errors.push({
        path: '',
        message: `Value "${value}" does not match pattern ${constraints.pattern}`,
        value,
        expected: `matches ${constraints.pattern}`
      });
    }
  }

  // Enum constraint
  if (constraints.enum && Array.isArray(constraints.enum)) {
    if (!constraints.enum.includes(value)) {
      errors.push({
        path: '',
        message: `Value "${value}" is not in allowed values: ${constraints.enum.join(', ')}`,
        value,
        expected: constraints.enum
      });
    }
  }

  // Format validation
  if (constraints.format && typeof value === 'string') {
    if (!validateFormat(value, constraints.format)) {
      errors.push({
        path: '',
        message: `Value "${value}" is not a valid ${constraints.format}`,
        value,
        expected: `valid ${constraints.format}`
      });
    }
  }

  // Custom validation
  if (constraints.custom && typeof constraints.custom === 'function') {
    try {
      if (!constraints.custom(value)) {
        errors.push({
          path: '',
          message: 'Value failed custom validation',
          value,
          expected: 'pass custom validation'
        });
      }
    } catch (error: any) {
      errors.push({
        path: '',
        message: `Custom validation error: ${error.message}`,
        value,
        expected: 'valid value'
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create a validator function for a schema
 */
export function createValidator(schema: JsonSchema) {
  return (json: JsonValue): ValidationResult => {
    return validateSchema(json, schema);
  };
}

/**
 * Validate JSON path exists
 */
export function validatePath(
  json: JsonValue,
  path: string
): ValidationResult {
  const errors: ValidationError[] = [];
  
  try {
    const result = getValueByPath(json, path);
    if (result === undefined) {
      errors.push({
        path,
        message: `Path "${path}" does not exist`,
        expected: 'defined value'
      });
    }
  } catch (error: any) {
    errors.push({
      path,
      message: `Invalid path: ${error.message}`,
      expected: 'valid path'
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Helper functions
function validateAgainstSchema(
  json: JsonValue,
  schema: JsonSchema,
  basePath: string = ''
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Type validation
  if (schema.type) {
    const actualType = getTypeName(json);
    const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    
    if (!expectedTypes.includes(actualType)) {
      errors.push(createError(
        basePath,
        `Type "${actualType}" does not match expected type(s): ${expectedTypes.join(', ')}`,
        json,
        expectedTypes
      ));
      return errors; // Stop further validation on type mismatch
    }
  }

  // Additional validations based on type
  if (Array.isArray(json)) {
    errors.push(...validateArrayAgainstSchema(json, schema, basePath));
  } else if (typeof json === 'object' && json !== null) {
    errors.push(...validateObjectAgainstSchema(json as JsonObject, schema, basePath));
  } else {
    errors.push(...validatePrimitiveAgainstSchema(json, schema, basePath));
  }

  return errors;
}

function validateArrayAgainstSchema(
  array: JsonArray,
  schema: JsonSchema,
  basePath: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Min items
  if (schema.minItems !== undefined && array.length < schema.minItems) {
    errors.push(createError(
      basePath,
      `Array has ${array.length} items, minimum required is ${schema.minItems}`,
      array.length,
      `>= ${schema.minItems}`
    ));
  }

  // Max items
  if (schema.maxItems !== undefined && array.length > schema.maxItems) {
    errors.push(createError(
      basePath,
      `Array has ${array.length} items, maximum allowed is ${schema.maxItems}`,
      array.length,
      `<= ${schema.maxItems}`
    ));
  }

  // Unique items
  if (schema.uniqueItems) {
    const seen = new Set();
    for (let i = 0; i < array.length; i++) {
      const key = JSON.stringify(array[i]);
      if (seen.has(key)) {
        errors.push(createError(
          `${basePath}[${i}]`,
          'Duplicate item found',
          array[i],
          'unique value'
        ));
      }
      seen.add(key);
    }
  }

  // Item validation
  if (schema.items) {
    for (let i = 0; i < array.length; i++) {
      const itemErrors = validateAgainstSchema(array[i], schema.items, `${basePath}[${i}]`);
      errors.push(...itemErrors);
    }
  }

  return errors;
}

function validateObjectAgainstSchema(
  obj: JsonObject,
  schema: JsonSchema,
  basePath: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required properties
  if (schema.required && Array.isArray(schema.required)) {
    for (const prop of schema.required) {
      if (!(prop in obj)) {
        errors.push(createError(
          `${basePath}.${prop}`,
          `Required property "${prop}" is missing`,
          undefined,
          'present'
        ));
      }
    }
  }

  // Property validation
  if (schema.properties && typeof schema.properties === 'object') {
    for (const [prop, propSchema] of Object.entries(schema.properties)) {
      if (prop in obj) {
        const propErrors = validateAgainstSchema(obj[prop], propSchema as JsonSchema, `${basePath}.${prop}`);
        errors.push(...propErrors);
      }
    }
  }

  // Additional properties
  if (schema.additionalProperties === false) {
    const allowedProps = schema.properties ? Object.keys(schema.properties) : [];
    for (const prop of Object.keys(obj)) {
      if (!allowedProps.includes(prop)) {
        errors.push(createError(
          `${basePath}.${prop}`,
          `Additional property "${prop}" is not allowed`,
          obj[prop],
          'undefined'
        ));
      }
    }
  }

  // Min/max properties
  const propCount = Object.keys(obj).length;
  if (schema.minProperties !== undefined && propCount < schema.minProperties) {
    errors.push(createError(
      basePath,
      `Object has ${propCount} properties, minimum required is ${schema.minProperties}`,
      propCount,
      `>= ${schema.minProperties}`
    ));
  }

  if (schema.maxProperties !== undefined && propCount > schema.maxProperties) {
    errors.push(createError(
      basePath,
      `Object has ${propCount} properties, maximum allowed is ${schema.maxProperties}`,
      propCount,
      `<= ${schema.maxProperties}`
    ));
  }

  return errors;
}

function validatePrimitiveAgainstSchema(
  value: JsonValue,
  schema: JsonSchema,
  basePath: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Enum validation
  if (schema.enum && Array.isArray(schema.enum)) {
    if (!schema.enum.includes(value)) {
      errors.push(createError(
        basePath,
        `Value "${value}" is not in allowed values: ${schema.enum.join(', ')}`,
        value,
        schema.enum
      ));
    }
  }

  // Const validation
  if (schema.const !== undefined && value !== schema.const) {
    errors.push(createError(
      basePath,
      `Value "${value}" does not match constant "${schema.const}"`,
      value,
      schema.const
    ));
  }

  // Format validation for strings
  if (schema.format && typeof value === 'string') {
    if (!validateFormat(value, schema.format)) {
      errors.push(createError(
        basePath,
        `Value "${value}" is not a valid ${schema.format}`,
        value,
        `valid ${schema.format}`
      ));
    }
  }

  // Pattern validation for strings
  if (schema.pattern && typeof value === 'string') {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(value)) {
      errors.push(createError(
        basePath,
        `Value "${value}" does not match pattern ${schema.pattern}`,
        value,
        `matches ${schema.pattern}`
      ));
    }
  }

  // Numeric validations
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(createError(
        basePath,
        `Value ${value} is less than minimum ${schema.minimum}`,
        value,
        `>= ${schema.minimum}`
      ));
    }

    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      errors.push(createError(
        basePath,
        `Value ${value} is not greater than ${schema.exclusiveMinimum}`,
        value,
        `> ${schema.exclusiveMinimum}`
      ));
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(createError(
        basePath,
        `Value ${value} exceeds maximum ${schema.maximum}`,
        value,
        `<= ${schema.maximum}`
      ));
    }

    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
      errors.push(createError(
        basePath,
        `Value ${value} is not less than ${schema.exclusiveMaximum}`,
        value,
        `< ${schema.exclusiveMaximum}`
      ));
    }

    if (schema.multipleOf !== undefined && value % schema.multipleOf !== 0) {
      errors.push(createError(
        basePath,
        `Value ${value} is not a multiple of ${schema.multipleOf}`,
        value,
        `multiple of ${schema.multipleOf}`
      ));
    }
  }

  // String length validations
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(createError(
        basePath,
        `String length ${value.length} is less than minimum ${schema.minLength}`,
        value.length,
        `>= ${schema.minLength}`
      ));
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(createError(
        basePath,
        `String length ${value.length} exceeds maximum ${schema.maxLength}`,
        value.length,
        `<= ${schema.maxLength}`
      ));
    }
  }

  // Array length validations for strings (array of characters)
  if (typeof value === 'string' && schema.minLength !== undefined) {
    if (value.length < schema.minLength) {
      errors.push(createError(
        basePath,
        `String length ${value.length} is less than minimum ${schema.minLength}`,
        value.length,
        `>= ${schema.minLength}`
      ));
    }
  }

  return errors;
}

function validateFormat(value: string, format: string): boolean {
  switch (format) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'url':
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
    case 'date-time':
      return !isNaN(Date.parse(value));
    case 'uuid':
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    default:
      return true;
  }
}

function getTypeName(value: JsonValue): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function checkConstraint(value: any, constraint: any): boolean {
  if (constraint === null || constraint === undefined) {
    return true;
  }

  if (typeof constraint === 'function') {
    return constraint(value);
  }

  if (constraint instanceof RegExp) {
    return constraint.test(String(value));
  }

  if (Array.isArray(constraint)) {
    return constraint.includes(value);
  }

  if (typeof constraint === 'object') {
    // Complex constraint object
    if (constraint.min !== undefined && value < constraint.min) return false;
    if (constraint.max !== undefined && value > constraint.max) return false;
    if (constraint.pattern && !new RegExp(constraint.pattern).test(String(value))) return false;
    return true;
  }

  return value === constraint;
}

function getValueByPath(json: JsonValue, path: string): JsonValue | undefined {
  const parts = path.split('.');
  let current: any = json;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = parseInt(part, 10);
      if (isNaN(index) || index < 0 || index >= current.length) {
        return undefined;
      }
      current = current[index];
    } else if (typeof current === 'object') {
      current = current[part];
    } else {
      return undefined;
    }
  }

  return current;
}

function createError(
  path: string,
  message: string,
  value?: any,
  expected?: any
): ValidationError {
  return {
    path: path || '',
    message,
    value,
    expected
  };
}
