/**
 * Minimal JSON Schema type definition for LLM output format support
 */

export type JSONSchema = {
    type?: string;
    properties?: Record<string, JSONSchema>;
    items?: JSONSchema;
    required?: string[];
    enum?: any[];
    const?: any;
    anyOf?: JSONSchema[];
    oneOf?: JSONSchema[];
    allOf?: JSONSchema[];
    not?: JSONSchema;
    if?: JSONSchema;
    then?: JSONSchema;
    else?: JSONSchema;
    format?: string;
    pattern?: string;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
    additionalProperties?: boolean | JSONSchema;
    description?: string;
    title?: string;
    default?: any;
    examples?: any[];
    [key: string]: any; // Allow additional properties
};

export type typeOption = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null' | 'any';

export type _integer = number;
export type _year = number;
export type _month = number;
export type _day = number;
export type _hour = number;
export type _minute = number;
export type _second = number;
export type _millisecond = number;

export type JsonPath = string;

export const KEY_PATH_SIGN = '#';
export const ADD_MARKER = '+';
export const ARRAY_TITLE_MARKER = '[]';
export const REF = '$ref';

export function isJsonSchemaKeyword(key: string): boolean {
    const keywords = [
        'type', 'properties', 'items', 'required', 'enum', 'const',
        'anyOf', 'oneOf', 'allOf', 'not', 'if', 'then', 'else',
        'format', 'pattern', 'minimum', 'maximum', 'minLength', 'maxLength',
        'minItems', 'maxItems', 'uniqueItems', 'additionalProperties',
        'description', 'title', 'default', 'examples'
    ];
    return keywords.includes(key);
}

export function typeOption(value: any): string {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'any';
}
