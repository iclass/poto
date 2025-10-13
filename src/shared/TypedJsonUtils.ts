import { TypedJSON } from './TypedJSON';

/**
 * Utility functions for seamless TypedJSON integration in Poto framework
 * This module provides drop-in replacements for JSON.parse/stringify that
 * automatically handle both regular JSON and type-preserved JSON
 */

/**
 * Enhanced JSON parsing that handles both regular JSON and TypedJSON
 * This is a drop-in replacement for JSON.parse
 */
export function parseTypedJson<T = any>(jsonString: string): T {
  try {
    // First try parsing as regular JSON
    const parsed = JSON.parse(jsonString);
    
    // Check if this is type-preserved JSON
    if (TypedJSON.isTypePreserved(parsed)) {
      // Use TypedJSON for type reconstruction
      return TypedJSON.parse<T>(jsonString);
    }
    
    // Return regular JSON as-is
    return parsed as T;
  } catch (error) {
    // If JSON.parse fails, try TypedJSON.parse as fallback
    try {
      return TypedJSON.parse<T>(jsonString);
    } catch (typedError) {
      // Re-throw the original error for better debugging
      throw error;
    }
  }
}

/**
 * Enhanced JSON stringification that preserves types when needed
 * This is a drop-in replacement for JSON.stringify
 */
export function stringifyTypedJson(data: any, space?: string | number): string {
  // Check if the data contains types that need preservation
  const needsPreservation = needsTypePreservation(data);
  
  if (needsPreservation) {
    return TypedJSON.stringify(data, space);
  }
  
  // Use regular JSON.stringify for simple data
  return JSON.stringify(data, null, space);
}

/**
 * Async JSON parsing with native binary decoding (FAST!)
 * 
 * Uses native browser APIs (fetch + data URL) for base64 decoding,
 * which is much faster than the sync atob() + loop approach for binary data.
 * 
 * This is the async equivalent of parseTypedJson()
 */
export async function parseTypedJsonAsync<T = any>(jsonString: string): Promise<T> {
  try {
    // First try parsing as regular JSON
    const parsed = JSON.parse(jsonString);
    
    // Check if this is type-preserved JSON
    if (TypedJSON.isTypePreserved(parsed)) {
      // Use TypedJSON async parser for native binary decoding
      return await TypedJSON.parseAsync<T>(jsonString);
    }
    
    // Return regular JSON as-is
    return parsed as T;
  } catch (error) {
    // If JSON.parse fails, try TypedJSON.parseAsync as fallback
    try {
      return await TypedJSON.parseAsync<T>(jsonString);
    } catch (typedError) {
      // Re-throw the original error for better debugging
      throw error;
    }
  }
}

/**
 * Async version of stringifyJson that handles Blobs properly
 */
export async function stringifyTypedJsonAsync(data: any, space?: string | number): Promise<string> {
  // Check if the data contains types that need preservation
  if (needsTypePreservation(data)) {
    return await TypedJSON.stringifyAsync(data, space);
  }
  
  // Use regular JSON.stringify for simple data
  return JSON.stringify(data, null, space);
}

/**
 * Check if data contains types that need preservation
 */
function needsTypePreservation(data: any, depth: number = 0, maxDepth: number = 10, seen: WeakSet<object> = new WeakSet()): boolean {
  if (depth > maxDepth) return false;
  
  if (data === null || data === undefined) return false;
  
  // Check for circular references
  if (data && typeof data === 'object') {
    if (seen.has(data)) return true; // Circular reference detected
    seen.add(data);
  }
  
  // Check for types that need preservation
  if (data instanceof Date) return true;
  if (data instanceof RegExp) return true;
  if (data instanceof Map) return true;
  if (data instanceof Set) return true;
  if (data instanceof Error) return true;
  if (data instanceof URL) return true;
  if (data instanceof ArrayBuffer) return true;
  if (data instanceof Blob) return true;
  if (typeof data === 'bigint') return true;
  
  // Check for TypedArrays
  if (ArrayBuffer.isView(data) && !(data instanceof DataView)) return true;
  
  // Check for special number values
  if (typeof data === 'number') {
    if (isNaN(data) || data === Infinity || data === -Infinity) return true;
    if (data === 0 && 1/data === -Infinity) return true; // -0
    if (!Number.isSafeInteger(data)) return true;
  }
  
  // Check for ambiguous strings
  if (typeof data === 'string') {
    if (data === 'true' || data === 'false') return true;
    if (/^-?\d+$/.test(data)) return true;
    if (data === 'Infinity' || data === '-Infinity' || data === 'NaN') return true;
  }
  
  // Recursively check arrays and objects
  if (Array.isArray(data)) {
    return data.some(item => needsTypePreservation(item, depth + 1, maxDepth, seen));
  }
  
  if (typeof data === 'object') {
    return Object.values(data).some(value => needsTypePreservation(value, depth + 1, maxDepth, seen));
  }
  
  return false;
}

/**
 * Utility to check if a string contains type-preserved JSON
 */
export function isTypePreservedJson(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString);
    return TypedJSON.isTypePreserved(parsed);
  } catch {
    return false;
  }
}

/**
 * Safe parsing that never throws - returns null on error
 */
export function safeParseJson<T = any>(jsonString: string): T | null {
  try {
    return parseTypedJson<T>(jsonString);
  } catch {
    return null;
  }
}

/**
 * Safe stringification that never throws - returns stringified error on failure
 */
export function safeStringifyJson(data: any, space?: string | number): string {
  try {
    return stringifyTypedJson(data, space);
  } catch (error) {
    return JSON.stringify({ error: 'Serialization failed', message: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Async safe stringification that never throws
 */
export async function safeStringifyJsonAsync(data: any, space?: string | number): Promise<string> {
  try {
    return await stringifyTypedJsonAsync(data, space);
  } catch (error) {
    return JSON.stringify({ error: 'Serialization failed', message: error instanceof Error ? error.message : String(error) });
  }
}
