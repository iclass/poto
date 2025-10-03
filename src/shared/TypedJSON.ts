/**
 * Union type representing all possible serialized values
 * Includes both regular JSON types and type-preserved values with markers
 */
type SerializedValue = 
  | string 
  | number 
  | boolean 
  | null 
  | SerializedObject 
  | SerializedArray
  | SerializedValue[]  // Plain arrays without circular references
  | TypedSerializedValue;

/**
 * Interface for serialized plain objects
 * Keys are strings, values are any serialized value
 */
interface SerializedObject {
  [key: string]: SerializedValue;
}

/**
 * Interface for serialized arrays
 * Extends Array with serialized value elements
 */
interface SerializedArray extends Array<SerializedValue> {}

/**
 * Interface for objects that may contain type markers
 * Used internally for type checking
 */
interface TypeMarkerObject {
  [key: string]: any;
}

/**
 * Serialized Date object with ISO string representation
 */
interface SerializedDate {
  __date: string;
}

/**
 * Serialized RegExp object with source and flags
 */
interface SerializedRegExp {
  __regexp: {
    source: string;
    flags: string;
  };
}

/**
 * Serialized Map object as array of key-value pairs
 */
interface SerializedMap {
  __map: Array<[SerializedValue, SerializedValue]>;
}

/**
 * Serialized Set object as array of values
 */
interface SerializedSet {
  __set: SerializedValue[];
}

/**
 * Serialized BigInt value as string
 */
interface SerializedBigInt {
  __bigint: string;
}

/**
 * Serialized Number with special value handling
 * Can be string for Infinity, NaN, etc. or number for regular values
 */
interface SerializedNumber {
  __number: string | number;
}

/**
 * Serialized Boolean value
 */
interface SerializedBoolean {
  __boolean: boolean;
}

/**
 * Serialized String value (for ambiguous strings)
 */
interface SerializedString {
  __string: string;
}

/**
 * Serialized null value
 */
interface SerializedNull {
  __null: true;
}

/**
 * Serialized undefined value
 */
interface SerializedUndefined {
  __undefined: true;
}

/**
 * Serialized Blob object with base64 data and metadata
 */
interface SerializedBlob {
  __blob: {
    data: string;
    type: string;
    size: number;
    name?: string;
    lastModified?: number;
  };
}

/**
 * Serialized ArrayBuffer as base64 string
 */
interface SerializedArrayBuffer {
  __arraybuffer: string;
}

/**
 * Serialized TypedArray with constructor and offset information
 */
interface SerializedTypedArray {
  __typedarray: {
    data: string;
    constructor: string;
    byteOffset: number;
    byteLength: number;
  };
}

/**
 * Serialized DataView with buffer and offset information
 */
interface SerializedDataView {
  __dataview: {
    data: string;
    byteOffset: number;
    byteLength: number;
  };
}

/**
 * Serialized Error object with name, message, and optional properties
 */
interface SerializedError {
  __error: {
    name: string;
    message: string;
    stack?: string;
    code?: string | number;
    cause?: SerializedValue;
  };
}

/**
 * Serialized URL object as href string
 */
interface SerializedURL {
  __url: string;
}

/**
 * Reference to an object by ID (for circular reference resolution)
 */
interface SerializedRef {
  __ref: number;
}

/**
 * Placeholder for circular reference detection (legacy)
 */
interface SerializedCircularRef {
  __circular_ref: true;
}

/**
 * Serialized array with circular reference
 */
interface SerializedArray {
  __array: any[];
  __refId?: number;
}

/**
 * Union type of all type-preserved serialized values
 * Represents values that have explicit type markers
 */
type TypedSerializedValue = 
  | SerializedDate
  | SerializedRegExp
  | SerializedMap
  | SerializedSet
  | SerializedBigInt
  | SerializedNumber
  | SerializedBoolean
  | SerializedString
  | SerializedNull
  | SerializedUndefined
  | SerializedBlob
  | SerializedArrayBuffer
  | SerializedTypedArray
  | SerializedDataView
  | SerializedError
  | SerializedURL
  | SerializedRef
  | SerializedCircularRef
  | SerializedArray;

/**
 * Union type representing all possible deserialized values
 * Includes all JavaScript types that can be reconstructed
 */
type DeserializedValue = 
  | string 
  | number 
  | boolean 
  | null 
  | undefined
  | Date
  | RegExp
  | Map<any, any>
  | Set<any>
  | bigint
  | Blob
  | ArrayBuffer
  | ArrayBufferView
  | Error
  | URL
  | DeserializedObject
  | DeserializedArray;

/**
 * Interface for deserialized plain objects
 * Keys are strings, values are any deserialized value
 */
interface DeserializedObject {
  [key: string]: DeserializedValue;
}

/**
 * Interface for deserialized arrays
 * Extends Array with deserialized value elements
 */
interface DeserializedArray extends Array<DeserializedValue> {}



/**
 * TypedJSON - Advanced JSON serialization with type preservation, with top support of bun runtime.
 * 
 * A comprehensive JSON serialization library that preserves JavaScript types
 * that are normally lost during JSON.stringify/parse operations. This includes
 * support for Dates, RegExp, Map, Set, BigInt, Blob, ArrayBuffer, TypedArrays,
 * Error objects, URLs, and more.
 * 
 * Key Features:
 * - Type preservation: Maintains exact types through serialization/deserialization
 * - Memory safety: Built-in limits to prevent memory exhaustion attacks
 * - Circular reference handling: Detects and handles circular object references
 * - Async Blob support: Proper handling of binary data with async methods
 * - Backward compatibility: Can parse both type-preserved and regular JSON
 * - Performance optimized: Efficient serialization with chunked processing for large data
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const data = {
 *   date: new Date(),
 *   regex: /test/gi,
 *   map: new Map([['key', 'value']]),
 *   set: new Set([1, 2, 3]),
 *   bigint: BigInt(123),
 *   error: new Error('test')
 * };
 * 
 * const serialized = TypedJSON.stringify(data);
 * const deserialized = TypedJSON.parse(serialized);
 * 
 * // Async usage for Blobs
 * const blob = new Blob(['hello'], { type: 'text/plain' });
 * const serialized = await TypedJSON.stringifyAsync({ blob });
 * const deserialized = await TypedJSON.parse(serialized);
 * ```
 * 
 * @version 1.0.0
 * @author Poto Framework
 */
export class TypedJSON {
  /** Version identifier for the TypedJSON library */
  static readonly VERSION = '1.0.0';
  
  /**
   * Base64 encoding using Bun's built-in btoa
   * @private
   */
  private static _base64Encode(str: string): string {
    return btoa(str);
  }
  
  /**
   * Check if we're running in Bun/Node.js environment
   * @private
   */
  private static get isBunOrNode(): boolean {
    return typeof process !== 'undefined' && process.versions && !!(process.versions.node || process.versions.bun);
  }
  
  /**
   * Base64 decoding using Bun's built-in atob
   * @private
   */
  private static _base64Decode(str: string): string {
    return atob(str);
  }
  
  /**
   * Estimate binary size from base64 string and check against limits
   * @private
   */
  private static _validateBase64Size(base64: string, maxSize: number, typeName: string): void {
    // Base64 encoding increases size by ~33% (4/3 ratio)
    // So base64 length * 3/4 gives approximate binary size
    const estimatedSize = Math.floor(base64.length * 3 / 4);
    
    if (estimatedSize > maxSize) {
      throw new Error(`${typeName} size ${estimatedSize} bytes (estimated from base64) exceeds maximum allowed size of ${maxSize} bytes`);
    }
  }
  
  /**
   * Blob creation using Bun's built-in Blob constructor
   * @private
   */
  private static _createBlob(data: Uint8Array[], options?: { type?: string }): Blob {
    return new Blob(data as BlobPart[], options);
  }
  
  // Configuration constants for memory safety
  /** Maximum serialization depth to prevent stack overflow attacks */
  static readonly MAX_DEPTH = 20; // Conservative limit to prevent stack overflow
  /** Maximum allowed Blob size in bytes (50MB) */
  static readonly MAX_BLOB_SIZE = 50 * 1024 * 1024; // 50MB
  /** Maximum allowed ArrayBuffer size in bytes (50MB) */
  static readonly MAX_ARRAY_BUFFER_SIZE = 50 * 1024 * 1024; // 50MB
  /** Maximum allowed string length in characters (10MB) */
  static readonly MAX_STRING_LENGTH = 10 * 1024 * 1024; // 10MB
  
  /**
   * Type markers used to identify serialized types in JSON
   * These constants are used as keys in serialized objects to preserve type information
   * during JSON serialization/deserialization cycles.
   */
  static readonly TYPE_MARKERS = {
    /** Marker for Date objects */
    DATE: '__date' as const,
    /** Marker for RegExp objects */
    REGEXP: '__regexp' as const,
    /** Marker for Map objects */
    MAP: '__map' as const,
    /** Marker for Set objects */
    SET: '__set' as const,
    /** Marker for BigInt values */
    BIGINT: '__bigint' as const,
    /** Marker for special Number values (Infinity, NaN, etc.) */
    NUMBER: '__number' as const,
    /** Marker for Boolean values that need explicit preservation */
    BOOLEAN: '__boolean' as const,
    /** Marker for String values that could be ambiguous */
    STRING: '__string' as const,
    /** Marker for null values */
    NULL: '__null' as const,
    /** Marker for undefined values */
    UNDEFINED: '__undefined' as const,
    /** Marker for Blob objects */
    BLOB: '__blob' as const,
    /** Marker for ArrayBuffer objects */
    ARRAY_BUFFER: '__arraybuffer' as const,
    /** Marker for TypedArray objects (Uint8Array, Float32Array, etc.) */
    TYPED_ARRAY: '__typedarray' as const,
    /** Marker for DataView objects */
    DATA_VIEW: '__dataview' as const,
    /** Marker for Error objects */
    ERROR: '__error' as const,
    /** Marker for URL objects */
    URL: '__url' as const,
    /** Marker for object references (circular reference resolution) */
    REF: '__ref' as const,
    /** Marker for circular reference placeholders */
    CIRCULAR_REF: '__circular_ref' as const,
    /** Marker for arrays with circular references */
    ARRAY: '__array' as const,
  };

  /**
   * Serialize data with type preservation
   * 
   * Converts JavaScript objects to JSON strings while preserving type information
   * for complex types like Date, RegExp, Map, Set, BigInt, Blob, ArrayBuffer,
   * TypedArrays, Error objects, and URLs.
   * 
   * @param data - The data to serialize. Can be any JavaScript value including
   *               complex objects, primitives, arrays, and nested structures.
   * @param space - Optional spacing parameter for JSON formatting (same as JSON.stringify)
   * @returns A JSON string with embedded type information
   * 
   * @throws {Error} When serialization depth exceeds MAX_DEPTH
   * @throws {Error} When string length exceeds MAX_STRING_LENGTH
   * @throws {Error} When attempting to serialize Blob objects (use stringifyAsync instead)
   * 
   * @example
   * ```typescript
   * const data = {
   *   date: new Date('2023-01-01'),
   *   regex: /test/gi,
   *   map: new Map([['key', 'value']]),
   *   bigint: BigInt(123),
   *   specialNumber: Infinity
   * };
   * 
   * const json = TypedJSON.stringify(data);
   * console.log(json); // Contains type markers for preservation
   * ```
   */
  static stringify(data: any, space?: string | number): string {
    const seen = new WeakSet();
    const refs = new Map<object, number>();
    const serialized = this._serializeValue(data, seen, refs, 0, this.MAX_DEPTH);
    return JSON.stringify(serialized, null, space);
  }

  /**
   * Deserialize data with type reconstruction
   * 
   * Parses JSON strings and reconstructs the original JavaScript types.
   * This method can handle both type-preserved JSON (created by stringify/stringifyAsync)
   * and regular JSON (created by JSON.stringify).
   * 
   * @param jsonString - The JSON string to parse
   * @returns The deserialized data with original types restored
   * 
   * @template T - The expected return type (optional, defaults to any)
   * 
   * @example
   * ```typescript
   * const json = '{"__date":"2023-01-01T00:00:00.000Z","__regexp":{"source":"test","flags":"gi"}}';
   * const data = TypedJSON.parse(json);
   * 
   * console.log(data instanceof Date); // true
   * console.log(data instanceof RegExp); // true
   * ```
   */
  static parse<T = any>(jsonString: string): T {
    const parsed = JSON.parse(jsonString);
    const refs = new Map<number, any>();
    const result = this._deserializeValue(parsed, refs);
    
    // Second pass: resolve all references
    const visited = new WeakSet();
    this._resolveReferences(result, refs, visited);
    
    return result as T;
  }

  /**
   * Check if an object has any type markers (is type-preserved JSON)
   * 
   * Determines whether a parsed JSON object contains TypedJSON type markers,
   * indicating it was created by TypedJSON.stringify() or TypedJSON.stringifyAsync().
   * 
   * @param obj - The object to check for type markers
   * @returns true if the object contains type markers, false otherwise
   * 
   * @example
   * ```typescript
   * const regularJson = JSON.parse('{"name":"John","age":30}');
   * const typedJson = TypedJSON.parse('{"__date":"2023-01-01T00:00:00.000Z"}');
   * 
   * console.log(TypedJSON.isTypePreserved(regularJson)); // false
   * console.log(TypedJSON.isTypePreserved(typedJson)); // true
   * ```
   */
  static isTypePreserved(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false;
    
    const markers = Object.values(this.TYPE_MARKERS);
    
    // Check if object has any type markers at top level
    if (Object.keys(obj).some(key => markers.includes(key as any))) {
      return true;
    }
    
    // Recursively check nested objects (with depth limit for safety)
    return this._hasTypeMarkersRecursive(obj, 0, this.MAX_DEPTH);
  }

  /**
   * Recursively check for type markers in nested objects
   * Uses the same MAX_DEPTH limit as the main serialization for consistency
   * 
   * @private
   * @param obj - The object to check for type markers
   * @param depth - Current recursion depth
   * @param maxDepth - Maximum allowed recursion depth for safety
   * @returns true if any type markers are found, false otherwise
   */
  private static _hasTypeMarkersRecursive(obj: any, depth: number, maxDepth: number): boolean {
    if (depth > maxDepth) return false;
    
    if (obj && typeof obj === 'object') {
      const markers = Object.values(this.TYPE_MARKERS);
      
      // Check current object
      if (Object.keys(obj).some(key => markers.includes(key as any))) {
        return true;
      }
      
      // Check array elements
      if (Array.isArray(obj)) {
        for (const item of obj) {
          if (this._hasTypeMarkersRecursive(item, depth + 1, maxDepth)) {
            return true;
          }
        }
      } else {
        // Check object properties
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            if (this._hasTypeMarkersRecursive(obj[key], depth + 1, maxDepth)) {
              return true;
            }
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Serialize a value with type information
   * 
   * Core serialization method that handles all JavaScript types and preserves
   * their type information through the use of type markers. Handles circular
   * references, depth limits, and memory safety constraints.
   * 
   * @private
   * @param value - The value to serialize
   * @param seen - WeakSet to track circular references
   * @param refs - Map to track object references for circular resolution
   * @param depth - Current serialization depth
   * @param maxDepth - Maximum allowed depth to prevent stack overflow
   * @returns Serialized value with type markers
   * 
   * @throws {Error} When depth exceeds maxDepth
   * @throws {Error} When string length exceeds MAX_STRING_LENGTH
   * @throws {Error} When attempting to serialize Blob (use async version)
   */
  private static _serializeValue(value: any, seen: WeakSet<object>, refs: Map<object, number>, depth: number, maxDepth: number): SerializedValue {
    // Check depth limit
    if (depth > maxDepth) {
      throw new Error(`Maximum serialization depth of ${maxDepth} exceeded`);
    }

    // Handle null and undefined first
    if (value === null) {
      return null; // JSON natively handles null
    }
    
    if (value === undefined) {
      return { [this.TYPE_MARKERS.UNDEFINED]: true }; // undefined needs marking
    }

    // Check for circular references (but not for built-in objects that don't need it)
    if (value && typeof value === 'object' && 
        !(value instanceof Date) && 
        !(value instanceof RegExp) && 
        !(value instanceof Error) &&
        !(value instanceof URL) && 
        !(value instanceof ArrayBuffer) &&
        !(value instanceof Blob) &&
        !(value instanceof DataView)) {
      
      if (seen.has(value)) {
        // Return a reference to the already-seen object
        const refId = refs.get(value);
        if (refId !== undefined) {
          return { [this.TYPE_MARKERS.REF]: refId };
        }
        // This shouldn't happen, but fallback to legacy circular ref
        return { [this.TYPE_MARKERS.CIRCULAR_REF]: true };
      }
      seen.add(value);
      // Assign a unique ID to this object
      const refId = refs.size + 1;
      refs.set(value, refId);
    }

    // Handle primitive types that need explicit marking
    if (typeof value === 'number') {
      return this._serializeNumber(value);
    }
    
    if (typeof value === 'boolean') {
      return value; // JSON natively handles booleans
    }
    
    if (typeof value === 'bigint') {
      return { [this.TYPE_MARKERS.BIGINT]: value.toString() };
    }
    
    if (typeof value === 'string') {
      // Check string length limit
      if (value.length > this.MAX_STRING_LENGTH) {
        throw new Error(`String length ${value.length} exceeds maximum allowed length of ${this.MAX_STRING_LENGTH} characters`);
      }
      
      // JSON.parse always preserves strings correctly, no need for wrapping
      return value;
    }

    // Handle complex objects
    if (value instanceof Date) {
      // Check if the date is valid before calling toISOString()
      if (isNaN(value.getTime())) {
        return { [this.TYPE_MARKERS.DATE]: 'Invalid Date' };
      }
      return { [this.TYPE_MARKERS.DATE]: value.toISOString() };
    }
    
    if (value instanceof RegExp) {
      return {
        [this.TYPE_MARKERS.REGEXP]: {
          source: value.source,
          flags: value.flags
        }
      };
    }
    
    if (value instanceof Map) {
      const entries = Array.from(value.entries()).map(([k, v]) => [
        this._serializeValue(k, seen, refs, depth + 1, maxDepth),
        this._serializeValue(v, seen, refs, depth + 1, maxDepth)
      ]);
      const result: any = { [this.TYPE_MARKERS.MAP]: entries };
      
      // Add refId if this Map has been seen before (for circular reference resolution)
      const refId = refs.get(value);
      if (refId !== undefined) {
        result.__refId = refId;
      }
      
      return result;
    }
    
    if (value instanceof Set) {
      const entries = Array.from(value.values()).map(v => 
        this._serializeValue(v, seen, refs, depth + 1, maxDepth)
      );
      const result: any = { [this.TYPE_MARKERS.SET]: entries };
      
      // Add refId if this Set has been seen before (for circular reference resolution)
      const refId = refs.get(value);
      if (refId !== undefined) {
        result.__refId = refId;
      }
      
      return result;
    }
    
    if (value instanceof Blob) {
      // Sync serialization cannot properly handle Blobs
      // Throw an error to force users to use async serialization
      throw new Error('Blob serialization requires async method. Use TypedJSON.stringifyAsync() instead.');
    }
    
    if (value instanceof ArrayBuffer) {
      return this._serializeArrayBuffer(value);
    }
    
    // Handle TypedArrays
    if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
      return this._serializeTypedArray(value);
    }
    
    // Handle DataView
    if (value instanceof DataView) {
      return this._serializeDataView(value);
    }
    
    if (value instanceof Error) {
      return {
        [this.TYPE_MARKERS.ERROR]: {
          name: value.name,
          message: value.message,
          stack: value.stack,
          ...(('code' in value) && { code: (value as any).code }),
          ...(('cause' in value) && { cause: this._serializeValue((value as any).cause, seen, refs, depth + 1, maxDepth) })
        }
      };
    }
    
    if (value instanceof URL) {
      return { [this.TYPE_MARKERS.URL]: value.href };
    }

    // Handle arrays
    if (Array.isArray(value)) {
      const serializedItems = value.map(item => this._serializeValue(item, seen, refs, depth + 1, maxDepth));
      
      // Add ref ID to the serialized array if this array has a ref
      const refId = refs.get(value);
      if (refId !== undefined) {
        // If the array has a refId, we need to wrap it in an object because JSON.stringify
        // doesn't include non-indexed properties on arrays
        return {
          [this.TYPE_MARKERS.ARRAY]: serializedItems,
          __refId: refId
        };
      }
      
      return serializedItems;
    }

    // Handle plain objects
    if (typeof value === 'object') {
      const result: SerializedObject = {};
      
      // Add ref ID to the serialized object if this object has a ref
      const refId = refs.get(value);
      if (refId !== undefined) {
        (result as any).__refId = refId;
      }
      
      for (const [key, val] of Object.entries(value)) {
        result[key] = this._serializeValue(val, seen, refs, depth + 1, maxDepth);
      }
      return result;
    }

    // Fallback - return as is (shouldn't reach here for most cases)
    return value as SerializedValue;
  }

  /**
   * Serialize numbers with special value handling
   * 
   * Handles special number values like Infinity, -Infinity, NaN, and -0
   * that would be lost during regular JSON serialization. Also handles
   * large integers and numbers with precision issues.
   * 
   * @private
   * @param value - The number to serialize
   * @returns Serialized number with type marker
   */
  private static _serializeNumber(value: number): SerializedNumber {
    if (value === Infinity) {
      return { [this.TYPE_MARKERS.NUMBER]: 'Infinity' };
    }
    
    if (value === -Infinity) {
      return { [this.TYPE_MARKERS.NUMBER]: '-Infinity' };
    }
    
    if (isNaN(value)) {
      return { [this.TYPE_MARKERS.NUMBER]: 'NaN' };
    }
    
    if (value === 0 && 1/value === -Infinity) {
      return { [this.TYPE_MARKERS.NUMBER]: '-0' };
    }
    
    // Check if number is safe integer or needs preservation
    if (!Number.isSafeInteger(value) || this._hasDecimalPrecisionIssues(value)) {
      return { [this.TYPE_MARKERS.NUMBER]: value.toString() };
    }
    
    // For safe integers, return as plain number (JSON handles them fine)
    return value as unknown as SerializedNumber;
  }

  /**
   * Serialize Blob to base64 with metadata
   * 
   * Converts Blob objects to base64-encoded strings with metadata preservation.
   * Handles both browser and Node.js environments with appropriate optimizations
   * for large binary data using chunked processing.
   * 
   * @private
   * @param blob - The Blob object to serialize
   * @returns Promise resolving to serialized blob with metadata
   * 
   * @throws {Error} When blob size exceeds MAX_BLOB_SIZE
   * @throws {Error} When FileReader operations fail
   */
  private static async _serializeBlobAsync(blob: Blob): Promise<SerializedBlob> {
    // Check blob size limit
    if (blob.size > this.MAX_BLOB_SIZE) {
      throw new Error(`Blob size ${blob.size} exceeds maximum allowed size of ${this.MAX_BLOB_SIZE} bytes`);
    }
    
    // Check if we're in a browser environment with FileReader
    if (typeof FileReader !== 'undefined') {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        
        const cleanup = () => {
          reader.onload = null;
          reader.onerror = null;
          reader.onabort = null;
        };
        
        reader.onload = () => {
          try {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(',')[1]); // Remove data:type;base64, prefix
          } finally {
            cleanup();
          }
        };
        
        reader.onerror = () => {
          cleanup();
          reject(new Error('FileReader failed to read blob'));
        };
        
        reader.onabort = () => {
          cleanup();
          reject(new Error('FileReader operation was aborted'));
        };
        
        try {
          reader.readAsDataURL(blob);
        } catch (error) {
          cleanup();
          reject(error);
        }
      });

      return {
        [this.TYPE_MARKERS.BLOB]: {
          data: base64,
          type: blob.type,
          size: blob.size,
          name: (blob as any).name || undefined,
          lastModified: (blob as any).lastModified || Date.now()
        }
      };
    } else {
      // Fallback for Node.js environment - use ArrayBuffer approach
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      let base64: string;
      // Use more efficient approach for large buffers
      if (bytes.length > 8192) {
        // For large buffers, use chunked processing to avoid memory issues
        const chunkSize = 8192;
        let binary = '';
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.slice(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        base64 = this._base64Encode(binary);
      } else {
        // For smaller buffers, use the direct approach
        const binary = String.fromCharCode.apply(null, Array.from(bytes));
        base64 = this._base64Encode(binary);
      }

      return {
        [this.TYPE_MARKERS.BLOB]: {
          data: base64,
          type: blob.type,
          size: blob.size,
          name: (blob as any).name || undefined,
          lastModified: (blob as any).lastModified || Date.now()
        }
      };
    }
  }

  /**
   * Serialize TypedArray to base64 with type information
   * 
   * Converts TypedArray objects (Uint8Array, Float32Array, etc.) to base64
   * with constructor name and offset information for proper reconstruction.
   * 
   * @private
   * @param typedArray - The TypedArray to serialize
   * @returns Serialized TypedArray with type and offset information
   */
  private static _serializeTypedArray(typedArray: ArrayBufferView): SerializedTypedArray {
    // Warn about non-zero offset TypedArrays that may lose context
    if (typedArray.byteOffset !== 0) {
      console.warn('Non-zero offset TypedArrays may lose context during serialization');
    }
    
    const buffer = typedArray.buffer.slice(typedArray.byteOffset, typedArray.byteOffset + typedArray.byteLength);
    // Ensure we have an ArrayBuffer, not SharedArrayBuffer
    const arrayBuffer = buffer instanceof ArrayBuffer ? buffer : new ArrayBuffer(buffer.byteLength);
    if (!(buffer instanceof ArrayBuffer)) {
      // Copy data from SharedArrayBuffer to ArrayBuffer
      new Uint8Array(arrayBuffer).set(new Uint8Array(buffer));
    }
    const base64 = this._arrayBufferToBase64(arrayBuffer);
    
    return {
      [this.TYPE_MARKERS.TYPED_ARRAY]: {
        data: base64,
        constructor: typedArray.constructor.name,
        byteOffset: 0, // Always 0 since we sliced the buffer to start fresh
        byteLength: typedArray.byteLength
      }
    };
  }

  /**
   * Serialize DataView to base64 with offset information
   * 
   * Converts DataView objects to base64 with offset and length information
   * for proper reconstruction. Similar to TypedArray handling but without
   * constructor information since DataView is a single constructor.
   * 
   * @private
   * @param dataView - The DataView to serialize
   * @returns Serialized DataView with offset and length information
   */
  private static _serializeDataView(dataView: DataView): SerializedDataView {
    // Warn about non-zero offset DataViews that may lose context
    if (dataView.byteOffset !== 0) {
      console.warn('Non-zero offset DataViews may lose context during serialization');
    }
    
    const buffer = dataView.buffer.slice(dataView.byteOffset, dataView.byteOffset + dataView.byteLength);
    // Ensure we have an ArrayBuffer, not SharedArrayBuffer
    const arrayBuffer = buffer instanceof ArrayBuffer ? buffer : new ArrayBuffer(buffer.byteLength);
    if (!(buffer instanceof ArrayBuffer)) {
      // Copy data from SharedArrayBuffer to ArrayBuffer
      new Uint8Array(arrayBuffer).set(new Uint8Array(buffer));
    }
    const base64 = this._arrayBufferToBase64(arrayBuffer);
    
    return {
      [this.TYPE_MARKERS.DATA_VIEW]: {
        data: base64,
        byteOffset: 0, // Always 0 since we sliced the buffer to start fresh
        byteLength: dataView.byteLength
      }
    };
  }

  /**
   * Convert ArrayBuffer to base64 string
   * 
   * Efficiently converts ArrayBuffer to base64 using chunked processing
   * for large buffers to avoid memory issues and stack overflow.
   * 
   * @private
   * @param buffer - The ArrayBuffer to convert
   * @returns Base64-encoded string
   * 
   * @throws {Error} When buffer size exceeds MAX_ARRAY_BUFFER_SIZE
   */
  private static _arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    
    // Check buffer size limit
    if (bytes.length > this.MAX_ARRAY_BUFFER_SIZE) {
      throw new Error(`ArrayBuffer size ${bytes.length} exceeds maximum allowed size of ${this.MAX_ARRAY_BUFFER_SIZE} bytes`);
    }
    
    // Use optimized approach based on environment
    if (this.isBunOrNode && typeof Buffer !== 'undefined') {
      // Use Buffer for efficient base64 conversion in Bun/Node
      return Buffer.from(buffer).toString('base64');
    } else {
      // Fallback to chunked String.fromCharCode approach for browsers
      if (bytes.length > 8192) {
        // For large buffers, use chunked processing to avoid memory issues
        const chunkSize = 8192;
        let binary = '';
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.slice(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        return this._base64Encode(binary);
      } else {
        // For smaller buffers, use the direct approach
        const binary = String.fromCharCode.apply(null, Array.from(bytes));
        return this._base64Encode(binary);
      }
    }
  }

  /**
   * Serialize ArrayBuffer to base64
   * 
   * Converts ArrayBuffer to base64-encoded string with type marker.
   * 
   * @private
   * @param buffer - The ArrayBuffer to serialize
   * @returns Serialized ArrayBuffer with type marker
   */
  private static _serializeArrayBuffer(buffer: ArrayBuffer): SerializedArrayBuffer {
    const base64 = this._arrayBufferToBase64(buffer);
    return {
      [this.TYPE_MARKERS.ARRAY_BUFFER]: base64
    };
  }


  /**
   * Check if number has decimal precision issues
   * 
   * Determines if a number might lose precision during JSON serialization
   * due to floating-point limitations or large integer values.
   * 
   * @private
   * @param value - The number to check for precision issues
   * @returns true if the number might lose precision, false otherwise
   */
  private static _hasDecimalPrecisionIssues(value: number): boolean {
    // Very small numbers that might lose precision
    if (Math.abs(value) > 0 && Math.abs(value) < 1e-10) return true;
    
    // Very large numbers
    if (Math.abs(value) > 1e15) return true;
    
    // Numbers with many decimal places
    const str = value.toString();
    if (str.includes('.') && str.split('.')[1].length > 10) return true;
    
    return false;
  }

  /**
   * Deserialize a value with type reconstruction
   * 
   * Core deserialization method that reconstructs original JavaScript types
   * from serialized data. Handles both type-preserved JSON and regular JSON
   * for backward compatibility.
   * 
   * @private
   * @param value - The value to deserialize
   * @param refs - Map to store resolved object references for circular resolution
   * @returns Deserialized value with original types restored
   */
  private static _deserializeValue(value: any, refs: Map<number, any>): DeserializedValue {
    // Handle type-marked objects (type-preserved JSON)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const deserialized = this._deserializeTypedValue(value, refs);
      if (deserialized !== value) {
        // Value was successfully deserialized as a typed value
        return deserialized;
      }
      // If not a typed value, continue with regular object processing
    }

    // Handle arrays (both type-preserved and regular)
    if (Array.isArray(value)) {
      const result = value.map(item => this._deserializeValue(item, refs));
      
      // Check if this array has a ref ID and store it in the refs map
      const refId = (value as any).__refId;
      if (refId !== undefined) {
        refs.set(refId, result);
      }
      
      return result;
    }

    // Handle plain objects (regular JSON or nested objects in type-preserved JSON)
    if (typeof value === 'object' && value !== null) {
      const result: DeserializedObject = {};
      
      // Check if this object has a ref ID and store it in the refs map
      const refId = (value as any).__refId;
      if (refId !== undefined) {
        refs.set(refId, result);
      }
      
      for (const [key, val] of Object.entries(value)) {
        if (key !== '__refId') { // Skip the refId marker
          result[key] = this._deserializeValue(val, refs);
        }
      }
      return result;
    }

    // Return primitives as-is (regular JSON values)
    return value;
  }

  /**
   * Attempt to deserialize a typed value, return original if not a typed value
   * 
   * Checks for type markers and reconstructs the appropriate JavaScript type.
   * Returns the original value if no type markers are found.
   * 
   * @private
   * @param value - The value to check for type markers and deserialize
   * @param refs - Map to store resolved object references for circular resolution
   * @returns Deserialized typed value or original value if not typed
   */
  private static _deserializeTypedValue(value: any, refs: Map<number, any>): DeserializedValue {
    const typedValue = value as TypedSerializedValue;
    
    if (this.TYPE_MARKERS.DATE in typedValue) {
      const dateString = (typedValue as SerializedDate)[this.TYPE_MARKERS.DATE];
      if (dateString === 'Invalid Date') {
        return new Date('invalid');
      }
      return new Date(dateString);
    }
    
    if (this.TYPE_MARKERS.REGEXP in typedValue) {
      const regexData = (typedValue as SerializedRegExp)[this.TYPE_MARKERS.REGEXP];
      return new RegExp(regexData.source, regexData.flags);
    }
    
    if (this.TYPE_MARKERS.MAP in typedValue) {
      const mapData = (typedValue as SerializedMap)[this.TYPE_MARKERS.MAP];
      const result = new Map();
      
      // Store the Map in the refs map BEFORE deserializing items to allow circular references
      const refId = (typedValue as any).__refId;
      if (refId !== undefined) {
        refs.set(refId, result);
      }
      
      // Now deserialize the items - circular references can now be resolved
      for (const [k, v] of mapData) {
        result.set(
          this._deserializeValue(k, refs),
          this._deserializeValue(v, refs)
        );
      }
      
      return result;
    }
    
    if (this.TYPE_MARKERS.SET in typedValue) {
      const setData = (typedValue as SerializedSet)[this.TYPE_MARKERS.SET];
      const result = new Set();
      
      // Store the Set in the refs map BEFORE deserializing items to allow circular references
      const refId = (typedValue as any).__refId;
      if (refId !== undefined) {
        refs.set(refId, result);
      }
      
      // Now deserialize the items - circular references can now be resolved
      for (const v of setData) {
        result.add(this._deserializeValue(v, refs));
      }
      
      return result;
    }
    
    if (this.TYPE_MARKERS.BIGINT in typedValue) {
      return BigInt((typedValue as SerializedBigInt)[this.TYPE_MARKERS.BIGINT]);
    }
    
    if (this.TYPE_MARKERS.NUMBER in typedValue) {
      const numValue = (typedValue as SerializedNumber)[this.TYPE_MARKERS.NUMBER];
      if (numValue === 'Infinity') return Infinity;
      if (numValue === '-Infinity') return -Infinity;
      if (numValue === 'NaN') return NaN;
      if (numValue === '-0') return -0;
      return Number(numValue);
    }
    
    if (this.TYPE_MARKERS.BOOLEAN in typedValue) {
      return Boolean((typedValue as SerializedBoolean)[this.TYPE_MARKERS.BOOLEAN]);
    }
    
    if (this.TYPE_MARKERS.STRING in typedValue) {
      return String((typedValue as SerializedString)[this.TYPE_MARKERS.STRING]);
    }
    
    if (this.TYPE_MARKERS.NULL in typedValue) {
      return null;
    }
    
    if (this.TYPE_MARKERS.UNDEFINED in typedValue) {
      return undefined;
    }
    
    if (this.TYPE_MARKERS.BLOB in typedValue) {
      const blobData = (typedValue as SerializedBlob)[this.TYPE_MARKERS.BLOB];
      // Only reconstruct Blob if we have actual data (including empty strings for empty Blobs)
      if (blobData.data !== undefined) {
        // Validate base64 size before decoding to prevent DoS attacks
        this._validateBase64Size(blobData.data, this.MAX_BLOB_SIZE, 'Blob');
        
        const binary = this._base64Decode(blobData.data);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          array[i] = binary.charCodeAt(i);
        }
        const blob = this._createBlob([array], { type: blobData.type });
        
        // Restore additional properties if they exist
        if (blobData.name) (blob as any).name = blobData.name;
        // Note: lastModified is a File-specific property, not applicable to Blob
        
        return blob;
      } else {
        // Return a placeholder or null for incomplete Blob data
        return null;
      }
    }
    
    if (this.TYPE_MARKERS.ARRAY_BUFFER in typedValue) {
      const bufferData = (typedValue as SerializedArrayBuffer)[this.TYPE_MARKERS.ARRAY_BUFFER];
      // Validate base64 size before decoding to prevent DoS attacks
      this._validateBase64Size(bufferData, this.MAX_ARRAY_BUFFER_SIZE, 'ArrayBuffer');
      
      const binary = this._base64Decode(bufferData);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      return array.buffer;
    }
    
    if (this.TYPE_MARKERS.TYPED_ARRAY in typedValue) {
      const typedArrayData = (typedValue as SerializedTypedArray)[this.TYPE_MARKERS.TYPED_ARRAY];
      // Validate base64 size before decoding to prevent DoS attacks
      this._validateBase64Size(typedArrayData.data, this.MAX_ARRAY_BUFFER_SIZE, 'TypedArray');
      
      const binary = this._base64Decode(typedArrayData.data);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      
      // Reconstruct the TypedArray using the constructor name
      // Since we always serialize with byteOffset: 0, we can safely use that
      const TypedArrayConstructor = (globalThis as any)[typedArrayData.constructor];
      if (TypedArrayConstructor) {
        return new TypedArrayConstructor(array.buffer, typedArrayData.byteOffset, typedArrayData.byteLength / TypedArrayConstructor.BYTES_PER_ELEMENT);
      } else {
        // Fallback to Uint8Array if constructor not found
        return new Uint8Array(array.buffer, typedArrayData.byteOffset, typedArrayData.byteLength);
      }
    }
    
    if (this.TYPE_MARKERS.DATA_VIEW in typedValue) {
      const dataViewData = (typedValue as SerializedDataView)[this.TYPE_MARKERS.DATA_VIEW];
      // Validate base64 size before decoding to prevent DoS attacks
      this._validateBase64Size(dataViewData.data, this.MAX_ARRAY_BUFFER_SIZE, 'DataView');
      
      const binary = this._base64Decode(dataViewData.data);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      
      // Reconstruct the DataView using the offset and length
      // Since we always serialize with byteOffset: 0, we can safely use that
      return new DataView(array.buffer, dataViewData.byteOffset, dataViewData.byteLength);
    }
    
    if (this.TYPE_MARKERS.ERROR in typedValue) {
      const errorData = (typedValue as SerializedError)[this.TYPE_MARKERS.ERROR];
      const error = new Error(errorData.message);
      error.name = errorData.name;
      error.stack = errorData.stack;
      if (errorData.code) (error as any).code = errorData.code;
      if (errorData.cause) (error as any).cause = this._deserializeValue(errorData.cause, refs);
      return error;
    }
    
    if (this.TYPE_MARKERS.URL in typedValue) {
      return new URL((typedValue as SerializedURL)[this.TYPE_MARKERS.URL]);
    }
    
    if (this.TYPE_MARKERS.REF in typedValue) {
      const refId = (typedValue as SerializedRef)[this.TYPE_MARKERS.REF];
      // Return the resolved reference if it exists, otherwise return a placeholder
      return refs.get(refId) || { __circularRef: true };
    }
    
    if (this.TYPE_MARKERS.CIRCULAR_REF in typedValue) {
      // Return a placeholder object for circular references
      return { __circularRef: true };
    }
    
    if (this.TYPE_MARKERS.ARRAY in typedValue) {
      // Deserialize array with circular reference
      const arrayData = (typedValue as SerializedArray)[this.TYPE_MARKERS.ARRAY];
      const result: any[] = [];
      
      // Store the array in the refs map BEFORE deserializing items to allow circular references
      const refId = (typedValue as any).__refId;
      if (refId !== undefined) {
        refs.set(refId, result);
      }
      
      // Now deserialize the items - circular references can now be resolved
      for (const item of arrayData) {
        result.push(this._deserializeValue(item, refs));
      }
      
      return result;
    }

    // Not a typed value, return original
    return value;
  }

  /**
   * Resolve all object references in the deserialized data
   * 
   * Performs a second pass to replace all __ref placeholders with actual object references.
   * This enables proper circular reference resolution.
   * 
   * @private
   * @param value - The value to resolve references in
   * @param refs - Map of resolved object references
   * @param visited - WeakSet to prevent infinite recursion
   */
  private static _resolveReferences(value: any, refs: Map<number, any>, visited: WeakSet<object>): void {
    if (value && typeof value === 'object' && !visited.has(value)) {
      visited.add(value);
      
      // Handle arrays
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          if (value[i] && typeof value[i] === 'object' && this.TYPE_MARKERS.REF in value[i]) {
            // Replace with the actual referenced object
            const refId = value[i][this.TYPE_MARKERS.REF];
            value[i] = refs.get(refId as number) || value[i];
          } else {
            this._resolveReferences(value[i], refs, visited);
          }
        }
      } else {
        // Handle objects
        for (const [key, val] of Object.entries(value)) {
          if (val && typeof val === 'object' && this.TYPE_MARKERS.REF in val) {
            // Replace with the actual referenced object
            const refId = val[this.TYPE_MARKERS.REF];
            (value as any)[key] = refs.get(refId as number) || val;
          } else {
            this._resolveReferences(val, refs, visited);
          }
        }
      }
    }
  }

  /**
   * Async version that properly handles Blobs
   * 
   * Serializes data with type preservation, including proper handling of Blob objects
   * which require async operations for base64 encoding. This method should be used
   * when your data contains Blob objects or when you want to ensure all binary
   * data is properly serialized.
   * 
   * @param data - The data to serialize. Can include Blob objects and other complex types
   * @param space - Optional spacing parameter for JSON formatting (same as JSON.stringify)
   * @returns A Promise that resolves to a JSON string with embedded type information
   * 
   * @throws {Error} When serialization depth exceeds MAX_DEPTH
   * @throws {Error} When Blob size exceeds MAX_BLOB_SIZE
   * @throws {Error} When ArrayBuffer size exceeds MAX_ARRAY_BUFFER_SIZE
   * @throws {Error} When string length exceeds MAX_STRING_LENGTH
   * 
   * @example
   * ```typescript
   * const data = {
   *   blob: new Blob(['hello world'], { type: 'text/plain' }),
   *   date: new Date(),
   *   arrayBuffer: new ArrayBuffer(8)
   * };
   * 
   * const json = await TypedJSON.stringifyAsync(data);
   * const deserialized = TypedJSON.parse(json);
   * 
   * console.log(deserialized.blob instanceof Blob); // true
   * console.log(deserialized.arrayBuffer instanceof ArrayBuffer); // true
   * ```
   */
  static async stringifyAsync(data: any, space?: string | number): Promise<string> {
    const seen = new WeakSet();
    const refs = new Map<object, number>();
    
    // First, scan for Blobs to determine if async processing is needed
    const hasBlobs = this._hasBlobs(data, seen);
    
    if (hasBlobs) {
      // Use async serialization only when Blobs are present
      const serialized = await this._serializeValueAsync(data, seen, refs, 0, this.MAX_DEPTH);
      return JSON.stringify(serialized, null, space);
    } else {
      // Use fast sync serialization when no Blobs are present
      const serialized = this._serializeValue(data, seen, refs, 0, this.MAX_DEPTH);
      return JSON.stringify(serialized, null, space);
    }
  }

  /**
   * Check if data contains any Blob objects
   * 
   * Fast scan to determine if async serialization is needed.
   * Avoids expensive serialization when no Blobs are present.
   * 
   * @private
   * @param value - The value to scan for Blobs
   * @param seen - WeakSet to track circular references
   * @returns true if Blobs are found, false otherwise
   */
  private static _hasBlobs(value: any, seen: WeakSet<object>): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    
    if (value instanceof Blob) {
      return true;
    }
    
    if (Array.isArray(value)) {
      for (const item of value) {
        if (this._hasBlobs(item, seen)) {
          return true;
        }
      }
      return false;
    }
    
    if (value && typeof value === 'object') {
      // Check for circular references
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      
      try {
        for (const [key, val] of Object.entries(value)) {
          if (this._hasBlobs(val, seen)) {
            return true;
          }
        }
        return false;
      } finally {
        seen.delete(value);
      }
    }
    
    return false;
  }

  /**
   * Async version of value serialization that handles Blob objects
   * 
   * Recursively serializes values with proper async handling for Blob objects.
   * Uses the synchronous serialization for all other types.
   * 
   * @private
   * @param value - The value to serialize
   * @param seen - WeakSet to track circular references
   * @param depth - Current serialization depth
   * @param maxDepth - Maximum allowed depth to prevent stack overflow
   * @returns Promise resolving to serialized value with type markers
   * 
   * @throws {Error} When depth exceeds maxDepth
   * @throws {Error} When Blob size exceeds MAX_BLOB_SIZE
   * @throws {Error} When ArrayBuffer size exceeds MAX_ARRAY_BUFFER_SIZE
   * @throws {Error} When string length exceeds MAX_STRING_LENGTH
   */
  private static async _serializeValueAsync(value: any, seen: WeakSet<object>, refs: Map<object, number>, depth: number, maxDepth: number): Promise<SerializedValue> {
    // Check depth limit
    if (depth > maxDepth) {
      throw new Error(`Maximum serialization depth of ${maxDepth} exceeded`);
    }

    // Check for circular references (but not for built-in objects)
    if (value && typeof value === 'object' && 
        !(value instanceof Date) && 
        !(value instanceof RegExp) && 
        !(value instanceof Map) && 
        !(value instanceof Set) && 
        !(value instanceof Error) &&
        !(value instanceof URL) && 
        !(value instanceof ArrayBuffer) &&
        !(value instanceof Blob) &&
        !(value instanceof DataView)) {
      
      if (seen.has(value)) {
        // Return a reference to the already-seen object
        const refId = refs.get(value);
        if (refId !== undefined) {
          return { [this.TYPE_MARKERS.REF]: refId };
        }
        // This shouldn't happen, but fallback to legacy circular ref
        return { [this.TYPE_MARKERS.CIRCULAR_REF]: true };
      }
      seen.add(value);
      // Assign a unique ID to this object
      const refId = refs.size + 1;
      refs.set(value, refId);
    }

    // Handle Blob specially in async version
    if (value instanceof Blob) {
      return await this._serializeBlobAsync(value) as SerializedValue;
    }
    
    // For other types, use the sync approach recursively
    if (Array.isArray(value)) {
      // Use Promise.all for parallel processing of array items
      const promises = value.map(item => this._serializeValueAsync(item, seen, refs, depth + 1, maxDepth));
      return Promise.all(promises);
    }
    
    if (value && typeof value === 'object' && !(value instanceof Date) && 
        !(value instanceof RegExp) && !(value instanceof Map) && 
        !(value instanceof Set) && !(value instanceof Error) &&
        !(value instanceof URL) && !(value instanceof ArrayBuffer) &&
        !(value instanceof DataView)) {
      
      const result: SerializedObject = {};
      const entries = Object.entries(value);
      
      // Use Promise.all for parallel processing of object values
      const promises = entries.map(async ([key, val]) => {
        const serializedVal = await this._serializeValueAsync(val, seen, refs, depth + 1, maxDepth);
        return [key, serializedVal] as [string, SerializedValue];
      });
      
      const resolvedEntries = await Promise.all(promises);
      for (const [key, val] of resolvedEntries) {
        result[key] = val;
      }
      
      return result;
    }
    
    return this._serializeValue(value, seen, refs, depth, maxDepth);
  }
}

// Export type utilities for consumers
export type {
  SerializedValue,
  SerializedObject,
  SerializedArray,
  TypedSerializedValue,
  SerializedDate,
  SerializedRegExp,
  SerializedMap,
  SerializedSet,
  SerializedBigInt,
  SerializedNumber,
  SerializedBoolean,
  SerializedString,
  SerializedNull,
  SerializedUndefined,
  SerializedBlob,
  SerializedArrayBuffer,
  SerializedTypedArray,
  SerializedDataView,
  SerializedError,
  SerializedURL,
  SerializedRef,
  SerializedCircularRef,
  DeserializedValue,
  DeserializedObject,
  DeserializedArray,
};