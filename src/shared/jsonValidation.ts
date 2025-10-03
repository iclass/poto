/**
 * Minimal JSON validation for LLM output format support
 */

import { JSONSchema } from './JSONSchema';
import { JsonSchemaFormat } from './JsonSchemaFormat';

export interface ValidationError {
    path: string;
    message: string;
}

export interface ValidationResult {
    errors: ValidationError[];
    isValid: boolean;
    isPartial?: boolean;
}

export function validateJson(schema: JSONSchema, data: any, path: string = ''): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Basic validation logic
    if (schema.type) {
        const actualType = getType(data);
        if (actualType !== schema.type && schema.type !== 'any') {
            errors.push({
                path: path || 'root',
                message: `Expected type ${schema.type}, got ${actualType}`
            });
        }
    }
    
    if (schema.format && typeof data === 'string') {
        if (!JsonSchemaFormat.validateBuiltInFormat(data, schema.format)) {
            errors.push({
                path: path || 'root',
                message: `Invalid format ${schema.format}`
            });
        }
    }
    
    if (schema.enum && !schema.enum.includes(data)) {
        errors.push({
            path: path || 'root',
            message: `Value must be one of: ${schema.enum.join(', ')}`
        });
    }
    
    return {
        errors,
        isValid: errors.length === 0,
        isPartial: false
    };
}

function getType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}
