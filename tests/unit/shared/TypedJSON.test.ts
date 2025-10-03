// TypedJSON.test.ts
import { describe, test, expect } from 'bun:test';
import { TypedJSON } from '../../../src/shared/TypedJSON';

describe('TypedJSON - Mixed JSON Support', () => {
  describe('Regular JSON Compatibility', () => {
    test('should parse regular JSON objects without type markers', () => {
      const regularJson = {
        name: "John Doe",
        age: 30,
        active: true,
        tags: ["user", "admin"],
        address: {
          street: "123 Main St",
          city: "Anytown"
        },
        scores: [95, 87, 92]
      };

      const jsonString = JSON.stringify(regularJson);
      const parsed = TypedJSON.parse<typeof regularJson>(jsonString);

      expect(parsed.name).toBe("John Doe");
      expect(parsed.age).toBe(30);
      expect(parsed.active).toBe(true);
      expect(Array.isArray(parsed.tags)).toBe(true);
      expect(parsed.tags).toEqual(["user", "admin"]);
      expect(parsed.address.street).toBe("123 Main St");
      expect(parsed.scores).toEqual([95, 87, 92]);
    });

    test('should parse JSON with null and undefined values', () => {
      const data = {
        value: "exists",
        nothing: null,
        items: [1, null, 3],
        config: {
          enabled: true,
          timeout: null
        }
      };

      const jsonString = JSON.stringify(data);
      const parsed = TypedJSON.parse<typeof data>(jsonString);

      expect(parsed.value).toBe("exists");
      expect(parsed.nothing).toBeNull();
      expect(parsed.items).toEqual([1, null, 3]);
      expect(parsed.config.enabled).toBe(true);
      expect(parsed.config.timeout).toBeNull();
    });

    test('should handle JSON arrays with mixed primitive types', () => {
      const data = {
        mixedArray: [1, "two", true, null, 3.14]
      };

      const jsonString = JSON.stringify(data);
      const parsed = TypedJSON.parse<typeof data>(jsonString);

      expect(parsed.mixedArray[0]).toBe(1);
      expect(parsed.mixedArray[1]).toBe("two");
      expect(parsed.mixedArray[2]).toBe(true);
      expect(parsed.mixedArray[3]).toBeNull();
      expect(parsed.mixedArray[4]).toBe(3.14);
    });
  });

  describe('Type-Preserved JSON', () => {
    test('should parse type-preserved JSON with complex types', () => {
      const typePreservedData = {
        date: { __date: "2023-01-01T12:00:00.000Z" },
        regex: { __regexp: { source: "test", flags: "gi" } },
        bigNumber: { __number: "9007199254740993" },
        isActive: { __boolean: true },
        idString: { __string: "123" }
      };

      const jsonString = JSON.stringify(typePreservedData);
      const parsed = TypedJSON.parse(jsonString);

      expect(parsed.date).toBeInstanceOf(Date);
      expect(parsed.date.getTime()).toBe(new Date("2023-01-01T12:00:00.000Z").getTime());
      expect(parsed.regex).toBeInstanceOf(RegExp);
      expect(parsed.regex.source).toBe("test");
      expect(parsed.regex.flags).toBe("gi");
      expect(parsed.bigNumber).toBe(9007199254740993);
      expect(parsed.isActive).toBe(true);
      expect(parsed.idString).toBe("123");
    });
  });

  describe('Mixed JSON (Type-Preserved and Regular)', () => {
    test('should handle objects with both type-preserved and regular properties', () => {
      const mixedData = {
        // Regular JSON properties
        name: "John Doe",
        age: 30,
        
        // Type-preserved properties
        createdAt: { __date: "2023-01-01T00:00:00.000Z" },
        settings: {
          theme: "dark",
          // Nested type-preserved
          lastModified: { __date: "2023-06-01T00:00:00.000Z" }
        },
        
        // Regular array with mixed content
        history: [
          "login",
          { __date: "2023-05-01T00:00:00.000Z" }, // Type-preserved in array
          "logout"
        ]
      };

      const jsonString = JSON.stringify(mixedData);
      const parsed = TypedJSON.parse(jsonString);

      // Regular properties
      expect(parsed.name).toBe("John Doe");
      expect(parsed.age).toBe(30);

      // Type-preserved properties
      expect(parsed.createdAt).toBeInstanceOf(Date);
      expect(parsed.settings.theme).toBe("dark");
      expect(parsed.settings.lastModified).toBeInstanceOf(Date);

      // Mixed array
      expect(parsed.history[0]).toBe("login");
      expect(parsed.history[1]).toBeInstanceOf(Date);
      expect(parsed.history[2]).toBe("logout");
    });
  });

  describe('isTypePreserved Method', () => {
    test('should detect type-preserved JSON', () => {
      const typePreserved = {
        date: { __date: "2023-01-01T00:00:00.000Z" },
        active: { __boolean: true }
      };

      const regularJson = {
        name: "John",
        age: 30,
        active: true
      };

      expect(TypedJSON.isTypePreserved(typePreserved)).toBe(true);
      expect(TypedJSON.isTypePreserved(regularJson)).toBe(false);
    });

    test('should detect nested type-preserved objects', () => {
      const data = {
        regular: "value",
        nested: {
          date: { __date: "2023-01-01T00:00:00.000Z" }
        }
      };

      expect(TypedJSON.isTypePreserved(data)).toBe(true);
    });

    test('should return false for primitive values', () => {
      expect(TypedJSON.isTypePreserved("hello")).toBe(false);
      expect(TypedJSON.isTypePreserved(42)).toBe(false);
      expect(TypedJSON.isTypePreserved(true)).toBe(false);
      expect(TypedJSON.isTypePreserved(null)).toBe(false);
    });
  });

  describe('Round-trip Compatibility', () => {
    test('should serialize and deserialize regular JSON unchanged', () => {
      const original = {
        name: "Alice",
        age: 25,
        active: true,
        tags: ["user", "premium"],
        address: {
          street: "456 Oak St",
          zip: "12345"
        }
      };

      const serialized = TypedJSON.stringify(original);
      const deserialized = TypedJSON.parse<typeof original>(serialized);

      expect(deserialized).toEqual(original);
      expect(JSON.stringify(deserialized)).toBe(JSON.stringify(original));
    });

    test('should handle JSON from external sources', () => {
      // Simulate JSON from an external API
      const externalApiResponse = {
        users: [
          { id: 1, name: "John", active: true },
          { id: 2, name: "Jane", active: false }
        ],
        pagination: {
          page: 1,
          total: 2,
          hasMore: false
        }
      };

      const jsonString = JSON.stringify(externalApiResponse);
      const parsed = TypedJSON.parse<typeof externalApiResponse>(jsonString);

      expect(parsed.users[0].name).toBe("John");
      expect(parsed.users[1].active).toBe(false);
      expect(parsed.pagination.page).toBe(1);
      expect(parsed.pagination.hasMore).toBe(false);
    });
  });

  describe('Blob Support', () => {
    test('should serialize and deserialize basic Blob with async method', async () => {
      const textContent = 'Hello, World!';
      const encoder = new TextEncoder();
      const data = encoder.encode(textContent);
      const blob = new Blob([data], { type: 'text/plain' });
      
      const serialized = await TypedJSON.stringifyAsync({ file: blob });
      const parsed = TypedJSON.parse(serialized);
      
      expect(parsed.file).toBeInstanceOf(Blob);
      expect(parsed.file.type).toBe('text/plain;charset=utf-8');
      expect(parsed.file.size).toBe(data.length);
    });

    test('should throw error for sync serialization with Blobs', () => {
      const textContent = 'Hello, World!';
      const blob = new Blob([textContent], { type: 'text/plain' });
      
      // Sync serialization should throw an error for Blobs
      expect(() => {
        TypedJSON.stringify({ file: blob });
      }).toThrow('Blob serialization requires async method. Use TypedJSON.stringifyAsync() instead.');
    });

    test('should handle Blob with different MIME types', async () => {
      const testCases = [
        { type: 'text/html', content: '<h1>Test</h1>' },
        { type: 'application/json', content: '{"key": "value"}' },
        { type: 'image/png', content: 'fake-png-data' },
        { type: '', content: 'no-type' }
      ];

      for (const testCase of testCases) {
        // Create Blob with Uint8Array to avoid automatic charset addition
        const encoder = new TextEncoder();
        const data = encoder.encode(testCase.content);
        const blob = new Blob([data], { type: testCase.type });
        
        const serialized = await TypedJSON.stringifyAsync({ file: blob });
        const parsed = TypedJSON.parse(serialized);
        
        expect(parsed.file).toBeInstanceOf(Blob);
        // For text types, browser adds charset automatically
        const expectedType = testCase.type.startsWith('text/') || testCase.type.startsWith('application/') 
          ? `${testCase.type};charset=utf-8` 
          : testCase.type;
        expect(parsed.file.type).toBe(expectedType);
        expect(parsed.file.size).toBe(data.length);
      }
    });

    test('should handle Blob with additional properties', async () => {
      const textContent = 'Test file content';
      const blob = new Blob([textContent], { type: 'text/plain' });
      
      // Add custom properties that might exist on File objects
      // Note: We can't modify lastModified on Blob, but we can test the serialization
      (blob as any).name = 'test.txt';
      
      const serialized = await TypedJSON.stringifyAsync({ file: blob });
      const parsed = TypedJSON.parse(serialized);
      
      expect(parsed.file).toBeInstanceOf(Blob);
      expect(parsed.file.type).toBe('text/plain;charset=utf-8');
      expect(parsed.file.size).toBe(textContent.length);
      expect((parsed.file as any).name).toBe('test.txt');
    });

    test('should handle Blob in arrays', async () => {
      const blob1 = new Blob(['content1'], { type: 'text/plain' });
      const blob2 = new Blob(['content2'], { type: 'text/html' });
      
      const data = {
        files: [blob1, blob2],
        metadata: 'file list'
      };
      
      const serialized = await TypedJSON.stringifyAsync(data);
      const parsed = TypedJSON.parse(serialized);
      
      expect(Array.isArray(parsed.files)).toBe(true);
      expect(parsed.files).toHaveLength(2);
      expect(parsed.files[0]).toBeInstanceOf(Blob);
      expect(parsed.files[1]).toBeInstanceOf(Blob);
      expect(parsed.files[0].type).toBe('text/plain;charset=utf-8');
      expect(parsed.files[1].type).toBe('text/html;charset=utf-8');
      expect(parsed.metadata).toBe('file list');
    });

    test('should handle Blob in nested objects', async () => {
      const blob = new Blob(['nested content'], { type: 'application/json' });
      
      const data = {
        user: {
          name: 'John',
          avatar: blob,
          settings: {
            theme: 'dark'
          }
        }
      };
      
      const serialized = await TypedJSON.stringifyAsync(data);
      const parsed = TypedJSON.parse(serialized);
      
      expect(parsed.user.name).toBe('John');
      expect(parsed.user.avatar).toBeInstanceOf(Blob);
      expect(parsed.user.avatar.type).toBe('application/json;charset=utf-8');
      expect(parsed.user.settings.theme).toBe('dark');
    });

    test('should handle mixed content with Blobs', async () => {
      const blob = new Blob(['mixed content'], { type: 'text/plain' });
      const date = new Date('2023-01-01T00:00:00.000Z');
      
      const data = {
        regular: 'string',
        number: 42,
        date: date,
        file: blob,
        array: [1, blob, 'text']
      };
      
      const serialized = await TypedJSON.stringifyAsync(data);
      const parsed = TypedJSON.parse(serialized);
      
      expect(parsed.regular).toBe('string');
      expect(parsed.number).toBe(42);
      expect(parsed.date).toBeInstanceOf(Date);
      expect(parsed.file).toBeInstanceOf(Blob);
      expect(Array.isArray(parsed.array)).toBe(true);
      expect(parsed.array[0]).toBe(1);
      expect(parsed.array[1]).toBeInstanceOf(Blob);
      expect(parsed.array[2]).toBe('text');
    });

    test('should handle empty Blob', async () => {
      const emptyBlob = new Blob([], { type: 'text/plain' });
      
      const serialized = await TypedJSON.stringifyAsync({ file: emptyBlob });
      const parsed = TypedJSON.parse(serialized);
      
      expect(parsed.file).toBeInstanceOf(Blob);
      expect(parsed.file.size).toBe(0);
      expect(parsed.file.type).toBe('text/plain;charset=utf-8');
    });

    test('should handle Blob with binary data', async () => {
      // Create a Blob with some binary-like data
      const binaryData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello" in bytes
      const blob = new Blob([binaryData], { type: 'application/octet-stream' });
      
      const serialized = await TypedJSON.stringifyAsync({ file: blob });
      const parsed = TypedJSON.parse(serialized);
      
      expect(parsed.file).toBeInstanceOf(Blob);
      expect(parsed.file.type).toBe('application/octet-stream');
      expect(parsed.file.size).toBe(5);
    });

    test('should handle multiple Blobs in complex structure', async () => {
      const blob1 = new Blob(['file1'], { type: 'text/plain' });
      const blob2 = new Blob(['file2'], { type: 'text/html' });
      const blob3 = new Blob(['file3'], { type: 'application/json' });
      
      const data = {
        documents: {
          primary: blob1,
          secondary: [blob2, blob3]
        },
        metadata: {
          count: 3,
          lastUpdated: new Date('2023-01-01T00:00:00.000Z')
        }
      };
      
      const serialized = await TypedJSON.stringifyAsync(data);
      const parsed = TypedJSON.parse(serialized);
      
      expect(parsed.documents.primary).toBeInstanceOf(Blob);
      expect(parsed.documents.primary.type).toBe('text/plain;charset=utf-8');
      
      expect(Array.isArray(parsed.documents.secondary)).toBe(true);
      expect(parsed.documents.secondary[0]).toBeInstanceOf(Blob);
      expect(parsed.documents.secondary[1]).toBeInstanceOf(Blob);
      expect(parsed.documents.secondary[0].type).toBe('text/html;charset=utf-8');
      expect(parsed.documents.secondary[1].type).toBe('application/json;charset=utf-8');
      
      expect(parsed.metadata.count).toBe(3);
      expect(parsed.metadata.lastUpdated).toBeInstanceOf(Date);
    });

    test('should handle Blob round-trip with actual content verification', async () => {
      const originalContent = 'This is test content for Blob round-trip verification';
      const blob = new Blob([originalContent], { type: 'text/plain' });
      
      // Test that sync serialization throws an error for Blobs
      expect(() => {
        TypedJSON.stringify({ file: blob });
      }).toThrow('Blob serialization requires async method. Use TypedJSON.stringifyAsync() instead.');
      
      // Test async serialization (this should preserve content)
      const asyncSerialized = await TypedJSON.stringifyAsync({ file: blob });
      const asyncParsed = TypedJSON.parse(asyncSerialized);
      
      expect(asyncParsed.file).toBeInstanceOf(Blob);
      expect(asyncParsed.file.type).toBe('text/plain;charset=utf-8');
      expect(asyncParsed.file.size).toBe(originalContent.length);
      
      // Verify content by reading the Blob
      const text = await asyncParsed.file.text();
      expect(text).toBe(originalContent);
    });

    test('should handle Blob with special characters', async () => {
      const specialContent = 'Special chars: àáâãäåæçèéêë ñöøùúûüýþÿ';
      const blob = new Blob([specialContent], { type: 'text/plain; charset=utf-8' });
      
      const serialized = await TypedJSON.stringifyAsync({ file: blob });
      const parsed = TypedJSON.parse(serialized);
      
      expect(parsed.file).toBeInstanceOf(Blob);
      expect(parsed.file.type).toBe('text/plain; charset=utf-8');
      // Note: The size might be different due to UTF-8 encoding
      expect(parsed.file.size).toBeGreaterThan(0);
    });

    test('should handle Blob serialization edge cases', async () => {
      // Test with very large content
      const largeContent = 'x'.repeat(10000);
      const largeBlob = new Blob([largeContent], { type: 'text/plain' });
      
      const serialized = await TypedJSON.stringifyAsync({ file: largeBlob });
      const parsed = TypedJSON.parse(serialized);
      
      expect(parsed.file).toBeInstanceOf(Blob);
      expect(parsed.file.size).toBe(10000);
      
      // Test with Blob containing multiple parts
      const multiPartBlob = new Blob(['part1', 'part2', 'part3'], { type: 'text/plain' });
      
      const serialized2 = await TypedJSON.stringifyAsync({ file: multiPartBlob });
      const parsed2 = TypedJSON.parse(serialized2);
      
      expect(parsed2.file).toBeInstanceOf(Blob);
      // 'part1' = 5, 'part2' = 5, 'part3' = 5, total = 15
      expect(parsed2.file.size).toBe(15);
    });
  });

  describe('Memory Safety Features', () => {
    test('should detect and handle circular references', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;
      
      const serialized = TypedJSON.stringify(obj);
      const parsed = TypedJSON.parse(serialized);
      
      expect(parsed.name).toBe('test');
      expect(parsed.self).toBe(parsed);
    });

    test('should handle nested circular references', () => {
      const parent: any = { name: 'parent' };
      const child: any = { name: 'child', parent: parent };
      parent.child = child;
      
      const serialized = TypedJSON.stringify(parent);
      const parsed = TypedJSON.parse(serialized);
      
      expect(parsed.name).toBe('parent');
      expect(parsed.child.name).toBe('child');
      expect(parsed.child.parent).toBe(parsed);
    });

    test('should handle reasonable nesting depth', () => {
      let deepObj: any = {};
      let current: any = deepObj;
      
      // Create a reasonably nested object (15 levels deep)
      for (let i = 0; i < 15; i++) {
        current.nested = {};
        current = current.nested;
      }
      
      // This should work fine
      expect(() => {
        TypedJSON.stringify(deepObj);
      }).not.toThrow();
    });

    test('should throw error for excessive depth', () => {
      let deepObj: any = {};
      let current: any = deepObj;
      
      // Create a deeply nested object (21 levels deep)
      for (let i = 0; i < 21; i++) {
        current.nested = {};
        current = current.nested;
      }
      
      expect(() => {
        TypedJSON.stringify(deepObj);
      }).toThrow('Maximum serialization depth of 20 exceeded');
    });

    test('should throw error for oversized Blob', async () => {
      // Create a large Blob (simulate 51MB)
      const largeData = new Uint8Array(51 * 1024 * 1024);
      const largeBlob = new Blob([largeData], { type: 'application/octet-stream' });
      
      await expect(TypedJSON.stringifyAsync({ file: largeBlob })).rejects.toThrow('Blob size');
    });

    test('should throw error for oversized ArrayBuffer', () => {
      const largeBuffer = new ArrayBuffer(51 * 1024 * 1024);
      
      expect(() => {
        TypedJSON.stringify({ buffer: largeBuffer });
      }).toThrow('ArrayBuffer size');
    });

    test('should throw error for oversized string', () => {
      const largeString = 'x'.repeat(11 * 1024 * 1024); // 11MB string
      
      expect(() => {
        TypedJSON.stringify({ text: largeString });
      }).toThrow('String length');
    });

    test('should handle async circular references', async () => {
      const obj: any = { name: 'test' };
      obj.self = obj;
      
      const serialized = await TypedJSON.stringifyAsync(obj);
      const parsed = TypedJSON.parse(serialized);
      
      expect(parsed.name).toBe('test');
      expect(parsed.self).toBe(parsed);
    });
  });

  describe('Property Order Preservation', () => {
    test('should preserve property order in regular JSON objects', () => {
      // Create an object with specific property order
      const original = {
        z: 'last',
        a: 'first',
        m: 'middle',
        b: 'second',
        y: 'second-to-last'
      };

      const serialized = TypedJSON.stringify(original);
      const parsed = TypedJSON.parse<typeof original>(serialized);

      // Get property names in order
      const originalKeys = Object.keys(original);
      const parsedKeys = Object.keys(parsed);

      expect(parsedKeys).toEqual(originalKeys);
      expect(JSON.stringify(parsed)).toBe(JSON.stringify(original));
    });

    test('should preserve property order in nested objects', () => {
      const original = {
        level1: {
          c: 'third',
          a: 'first',
          b: 'second'
        },
        level2: {
          z: 'last',
          x: 'second-to-last',
          y: 'middle'
        }
      };

      const serialized = TypedJSON.stringify(original);
      const parsed = TypedJSON.parse<typeof original>(serialized);

      // Check top-level order
      expect(Object.keys(parsed)).toEqual(['level1', 'level2']);
      
      // Check nested object order
      expect(Object.keys(parsed.level1)).toEqual(['c', 'a', 'b']);
      expect(Object.keys(parsed.level2)).toEqual(['z', 'x', 'y']);
    });

    test('should preserve property order with mixed type-preserved and regular properties', () => {
      const original = {
        regularString: 'hello',
        dateProp: new Date('2023-01-01T00:00:00.000Z'),
        regularNumber: 42,
        regexProp: /test/gi,
        regularBoolean: true,
        mapProp: new Map([['key', 'value']])
      };

      const serialized = TypedJSON.stringify(original);
      const parsed = TypedJSON.parse(serialized);

      // Check that property order is preserved
      const originalKeys = Object.keys(original);
      const parsedKeys = Object.keys(parsed);

      expect(parsedKeys).toEqual(originalKeys);
      
      // Verify values are correctly reconstructed
      expect(parsed.regularString).toBe('hello');
      expect(parsed.dateProp).toBeInstanceOf(Date);
      expect(parsed.regularNumber).toBe(42);
      expect(parsed.regexProp).toBeInstanceOf(RegExp);
      expect(parsed.regularBoolean).toBe(true);
      expect(parsed.mapProp).toBeInstanceOf(Map);
    });

    test('should preserve property order in arrays of objects', () => {
      const original = [
        { c: 'third', a: 'first', b: 'second' },
        { z: 'last', x: 'second-to-last', y: 'middle' },
        { m: 'middle', l: 'last', f: 'first' }
      ];

      const serialized = TypedJSON.stringify(original);
      const parsed = TypedJSON.parse<typeof original>(serialized);

      expect(parsed).toHaveLength(3);
      
      // Check property order in each array element
      expect(Object.keys(parsed[0])).toEqual(['c', 'a', 'b']);
      expect(Object.keys(parsed[1])).toEqual(['z', 'x', 'y']);
      expect(Object.keys(parsed[2])).toEqual(['m', 'l', 'f']);
    });

    test('should preserve property order with complex nested structures', () => {
      const original = {
        user: {
          id: 1,
          profile: {
            name: 'John',
            settings: {
              theme: 'dark',
              notifications: true
            }
          },
          createdAt: new Date('2023-01-01T00:00:00.000Z'),
          tags: ['admin', 'user']
        },
        metadata: {
          version: '1.0.0',
          lastModified: new Date('2023-06-01T00:00:00.000Z')
        }
      };

      const serialized = TypedJSON.stringify(original);
      const parsed = TypedJSON.parse(serialized);

      // Check top-level order
      expect(Object.keys(parsed)).toEqual(['user', 'metadata']);
      
      // Check user object order
      expect(Object.keys(parsed.user)).toEqual(['id', 'profile', 'createdAt', 'tags']);
      
      // Check profile object order
      expect(Object.keys(parsed.user.profile)).toEqual(['name', 'settings']);
      
      // Check settings object order
      expect(Object.keys(parsed.user.profile.settings)).toEqual(['theme', 'notifications']);
      
      // Check metadata object order
      expect(Object.keys(parsed.metadata)).toEqual(['version', 'lastModified']);
    });

    test('should preserve property order with async Blob serialization', async () => {
      const blob = new Blob(['test content'], { type: 'text/plain' });
      
      const original = {
        name: 'test',
        file: blob,
        size: 12,
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        metadata: {
          type: 'document',
          version: 1
        }
      };

      const serialized = await TypedJSON.stringifyAsync(original);
      const parsed = TypedJSON.parse(serialized);

      // Check property order is preserved
      expect(Object.keys(parsed)).toEqual(['name', 'file', 'size', 'createdAt', 'metadata']);
      expect(Object.keys(parsed.metadata)).toEqual(['type', 'version']);
      
      // Verify values
      expect(parsed.name).toBe('test');
      expect(parsed.file).toBeInstanceOf(Blob);
      expect(parsed.size).toBe(12);
      expect(parsed.createdAt).toBeInstanceOf(Date);
    });

    test('should preserve property order with Map and Set serialization', () => {
      const original = {
        regularProp: 'value',
        mapProp: new Map([['key1', 'value1'], ['key2', 'value2']]),
        setProp: new Set(['item1', 'item2', 'item3']),
        anotherRegular: 42
      };

      const serialized = TypedJSON.stringify(original);
      const parsed = TypedJSON.parse(serialized);

      // Check property order
      expect(Object.keys(parsed)).toEqual(['regularProp', 'mapProp', 'setProp', 'anotherRegular']);
      
      // Verify reconstructed types
      expect(parsed.mapProp).toBeInstanceOf(Map);
      expect(parsed.setProp).toBeInstanceOf(Set);
      expect(parsed.regularProp).toBe('value');
      expect(parsed.anotherRegular).toBe(42);
    });

    test('should preserve property order with special number values', () => {
      const original = {
        normalNumber: 42,
        infinity: Infinity,
        negativeInfinity: -Infinity,
        notANumber: NaN,
        negativeZero: -0,
        largeNumber: 9007199254740993
      };

      const serialized = TypedJSON.stringify(original);
      const parsed = TypedJSON.parse(serialized);

      // Check property order is preserved
      expect(Object.keys(parsed)).toEqual([
        'normalNumber', 
        'infinity', 
        'negativeInfinity', 
        'notANumber', 
        'negativeZero', 
        'largeNumber'
      ]);
      
      // Verify special number values are correctly reconstructed
      expect(parsed.normalNumber).toBe(42);
      expect(parsed.infinity).toBe(Infinity);
      expect(parsed.negativeInfinity).toBe(-Infinity);
      expect(Number.isNaN(parsed.notANumber)).toBe(true);
      expect(parsed.negativeZero).toBe(-0);
      expect(parsed.largeNumber).toBe(9007199254740993);
    });
  });

  describe('TypedArray Offset Handling', () => {
    test('should handle TypedArray with non-zero offset correctly', () => {
      // Create a TypedArray with non-zero offset (the problematic case)
      const originalBuffer = new ArrayBuffer(10);
      const typedArray = new Uint8Array(originalBuffer, 2, 5); // offset=2, length=5
      
      // Fill with test data
      typedArray[0] = 1;
      typedArray[1] = 2;
      typedArray[2] = 3;
      typedArray[3] = 4;
      typedArray[4] = 5;
      
      // Serialize and deserialize
      const serialized = TypedJSON.stringify({ data: typedArray });
      const parsed = TypedJSON.parse(serialized);
      const deserializedArray = parsed.data;
      
      // Verify the data is preserved correctly
      expect(deserializedArray).toBeInstanceOf(Uint8Array);
      expect(Array.from(deserializedArray)).toEqual([1, 2, 3, 4, 5]);
      expect(deserializedArray.byteLength).toBe(5);
      expect(deserializedArray.length).toBe(5);
      
      // The offset should be 0 after deserialization (since we slice the buffer)
      expect(deserializedArray.byteOffset).toBe(0);
    });

    test('should handle different TypedArray types with offset', () => {
      const buffer = new ArrayBuffer(20);
      const int32Array = new Int32Array(buffer, 4, 3); // offset=4, length=3
      
      int32Array[0] = 100;
      int32Array[1] = 200;
      int32Array[2] = 300;
      
      const serialized = TypedJSON.stringify({ data: int32Array });
      const parsed = TypedJSON.parse(serialized);
      const deserializedArray = parsed.data;
      
      expect(deserializedArray).toBeInstanceOf(Int32Array);
      expect(Array.from(deserializedArray)).toEqual([100, 200, 300]);
      expect(deserializedArray.byteLength).toBe(12); // 3 * 4 bytes
      expect(deserializedArray.byteOffset).toBe(0);
    });

    test('should handle Float32Array with offset', () => {
      const buffer = new ArrayBuffer(16);
      const floatArray = new Float32Array(buffer, 4, 2); // offset=4, length=2
      
      floatArray[0] = 1.5;
      floatArray[1] = 2.5;
      
      const serialized = TypedJSON.stringify({ data: floatArray });
      const parsed = TypedJSON.parse(serialized);
      const deserializedArray = parsed.data;
      
      expect(deserializedArray).toBeInstanceOf(Float32Array);
      expect(Array.from(deserializedArray)).toEqual([1.5, 2.5]);
      expect(deserializedArray.byteLength).toBe(8); // 2 * 4 bytes
      expect(deserializedArray.byteOffset).toBe(0);
    });

    test('should warn about non-zero offset TypedArrays', () => {
      const originalWarn = console.warn;
      const warnCalls: string[] = [];
      console.warn = (message: string) => warnCalls.push(message);
      
      const buffer = new ArrayBuffer(10);
      const typedArray = new Uint8Array(buffer, 2, 5);
      
      TypedJSON.stringify({ data: typedArray });
      
      expect(warnCalls).toContain('Non-zero offset TypedArrays may lose context during serialization');
      
      console.warn = originalWarn;
    });
  });

  describe('DataView Support', () => {
    test('should handle DataView with non-zero offset correctly', () => {
      // Create a DataView with non-zero offset
      const originalBuffer = new ArrayBuffer(10);
      const dataView = new DataView(originalBuffer, 2, 5); // offset=2, length=5
      
      // Write test data
      dataView.setUint8(0, 1);
      dataView.setUint8(1, 2);
      dataView.setUint8(2, 3);
      dataView.setUint8(3, 4);
      dataView.setUint8(4, 5);
      
      // Serialize and deserialize
      const serialized = TypedJSON.stringify({ data: dataView });
      const parsed = TypedJSON.parse(serialized);
      const deserializedDataView = parsed.data;
      
      // Verify the data is preserved correctly
      expect(deserializedDataView).toBeInstanceOf(DataView);
      expect(deserializedDataView.byteLength).toBe(5);
      expect(deserializedDataView.byteOffset).toBe(0);
      
      // Verify the values match
      const originalValues: any[] = [];
      for (let i = 0; i < dataView.byteLength; i++) {
        originalValues.push(dataView.getUint8(i));
      }
      
      const deserializedValues:any[] = [];
      for (let i = 0; i < deserializedDataView.byteLength; i++) {
        deserializedValues.push(deserializedDataView.getUint8(i));
      }
      
      expect(deserializedValues).toEqual(originalValues);
    });

    test('should handle DataView with different data types', () => {
      const buffer = new ArrayBuffer(8);
      const dataView = new DataView(buffer, 2, 4);
      
      // Write different data types
      dataView.setUint16(0, 0x1234, false); // Big endian
      dataView.setUint16(2, 0x5678, true);  // Little endian
      
      const serialized = TypedJSON.stringify({ data: dataView });
      const parsed = TypedJSON.parse(serialized);
      const deserializedDataView = parsed.data;
      
      expect(deserializedDataView).toBeInstanceOf(DataView);
      expect(deserializedDataView.byteLength).toBe(4);
      expect(deserializedDataView.byteOffset).toBe(0);
      
      // Verify the values match
      expect(deserializedDataView.getUint16(0, false)).toBe(0x1234);
      expect(deserializedDataView.getUint16(2, true)).toBe(0x5678);
    });

    test('should handle DataView with float values', () => {
      const buffer = new ArrayBuffer(8);
      const dataView = new DataView(buffer, 2, 4);
      
      // Write float values
      dataView.setFloat32(0, 3.14159, true); // Little endian
      
      const serialized = TypedJSON.stringify({ data: dataView });
      const parsed = TypedJSON.parse(serialized);
      const deserializedDataView = parsed.data;
      
      expect(deserializedDataView).toBeInstanceOf(DataView);
      expect(deserializedDataView.getFloat32(0, true)).toBeCloseTo(3.14159, 5);
    });

    test('should warn about non-zero offset DataViews', () => {
      const originalWarn = console.warn;
      const warnCalls: string[] = [];
      console.warn = (message: string) => warnCalls.push(message);
      
      const buffer = new ArrayBuffer(10);
      const dataView = new DataView(buffer, 2, 5);
      
      TypedJSON.stringify({ data: dataView });
      
      expect(warnCalls).toContain('Non-zero offset DataViews may lose context during serialization');
      
      console.warn = originalWarn;
    });

    test('should handle DataView in complex nested structures', () => {
      const buffer = new ArrayBuffer(6);
      const dataView = new DataView(buffer, 1, 4);
      dataView.setUint8(0, 10);
      dataView.setUint8(1, 20);
      dataView.setUint8(2, 30);
      dataView.setUint8(3, 40);
      
      const complexData = {
        metadata: {
          timestamp: new Date(),
          dataView: dataView
        },
        array: [1, 2, dataView, 'string'],
        map: new Map([['key', dataView]])
      };
      
      const serialized = TypedJSON.stringify(complexData);
      const parsed = TypedJSON.parse(serialized);
      
      expect(parsed.metadata.dataView).toBeInstanceOf(DataView);
      expect(parsed.array[2]).toBeInstanceOf(DataView);
      expect(parsed.map.get('key')).toBeInstanceOf(DataView);
      
      // Verify values are preserved
      expect(parsed.metadata.dataView.getUint8(0)).toBe(10);
      expect(parsed.metadata.dataView.getUint8(1)).toBe(20);
      expect(parsed.array[2].getUint8(0)).toBe(10);
      expect(parsed.map.get('key').getUint8(0)).toBe(10);
    });
  });

  describe('Circular Reference Resolution', () => {
    test('should handle object circular references correctly', () => {
      // Create a circular reference
      const objA = { name: 'A', value: 1, next: null as any };
      const objB = { name: 'B', value: 2, next: null as any };
      const objC = { name: 'C', value: 3, next: null as any };

      // Create circular references: A -> B -> C -> A
      objA.next = objB;
      objB.next = objC;
      objC.next = objA;

      const serialized = TypedJSON.stringify({ data: objA });
      const parsed = TypedJSON.parse(serialized);
      const deserializedA = parsed.data;

      // Verify the circular structure is preserved
      expect(deserializedA.name).toBe('A');
      expect(deserializedA.next.name).toBe('B');
      expect(deserializedA.next.next.name).toBe('C');
      expect(deserializedA.next.next.next).toBe(deserializedA);
    });

    test('should handle array circular references correctly', () => {
      // Create array circular reference
      const arr: any[] = [1, 2, 3];
      arr.push(arr); // arr[3] = arr

      const serialized = TypedJSON.stringify({ data: arr });
      const parsed = TypedJSON.parse(serialized);
      const deserializedArr = parsed.data;

      // Verify the circular structure is preserved
      expect(deserializedArr.length).toBe(4);
      expect(deserializedArr[0]).toBe(1);
      expect(deserializedArr[1]).toBe(2);
      expect(deserializedArr[2]).toBe(3);
      expect(deserializedArr[3]).toBe(deserializedArr);
    });

    test('should handle complex nested circular references', () => {
      const parent = { name: 'parent', children: [] as any[] };
      const child1 = { name: 'child1', parent: parent };
      const child2 = { name: 'child2', parent: parent };
      
      parent.children.push(child1, child2);

      const serialized = TypedJSON.stringify({ data: parent });
      const parsed = TypedJSON.parse(serialized);
      const deserializedParent = parsed.data;

      // Verify the circular structure is preserved
      expect(deserializedParent.name).toBe('parent');
      expect(deserializedParent.children.length).toBe(2);
      expect(deserializedParent.children[0].name).toBe('child1');
      expect(deserializedParent.children[0].parent).toBe(deserializedParent);
      expect(deserializedParent.children[1].name).toBe('child2');
      expect(deserializedParent.children[1].parent).toBe(deserializedParent);
    });

    test('should handle Map and Set with circular references', () => {
      const map = new Map();
      const set = new Set();
      
      map.set('self', map);
      set.add(set);

      const data = { map, set };
      const serialized = TypedJSON.stringify(data);
      const parsed = TypedJSON.parse(serialized);

      // Verify the circular structure is preserved
      expect(parsed.map.get('self')).toBe(parsed.map);
      expect(parsed.set.has(parsed.set)).toBe(true);
    });

    test('should handle mixed circular references', () => {
      const obj = { name: 'test', arr: [] as any[] };
      obj.arr.push(obj);

      const serialized = TypedJSON.stringify({ data: obj });
      const parsed = TypedJSON.parse(serialized);
      const deserialized = parsed.data;

      // Verify the circular structure is preserved
      expect(deserialized.name).toBe('test');
      expect(deserialized.arr.length).toBe(1);
      expect(deserialized.arr[0]).toBe(deserialized);
    });
  });
});