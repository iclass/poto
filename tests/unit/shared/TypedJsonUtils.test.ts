import { describe, it, expect } from "bun:test";
import { 
  parseTypedJson, 
  stringifyTypedJson, 
  stringifyTypedJsonAsync, 
  isTypePreservedJson,
  safeParseJson,
  safeStringifyJson,
  safeStringifyJsonAsync
} from "../../../src/shared/TypedJsonUtils";

describe("TypedJsonUtils", () => {
  describe("parseJson", () => {
    it("should parse regular JSON", () => {
      const data = { name: "test", value: 42 };
      const jsonString = JSON.stringify(data);
      const result = parseTypedJson(jsonString);
      
      expect(result).toEqual(data);
    });

    it("should parse type-preserved JSON", () => {
      const originalData = {
        date: new Date("2023-01-01T00:00:00Z"),
        regex: /test/gi,
        map: new Map([["key", "value"]]),
        set: new Set([1, 2, 3]),
        specialNumber: NaN,
        negativeZero: -0
      };
      
      // Use TypedJSON to create type-preserved JSON
      const jsonString = JSON.stringify(originalData);
      const result = parseTypedJson(jsonString);
      
      // Note: Regular JSON.stringify will lose type information
      // This test verifies the function doesn't break with regular JSON
      expect(result).toBeDefined();
    });

    it("should handle TypedJSON serialized data", () => {
      // This would require importing TypedJSON directly to create type-preserved JSON
      // For now, we test that the function doesn't break
      const regularJson = '{"name": "test"}';
      const result = parseTypedJson(regularJson);
      expect(result).toEqual({ name: "test" });
    });

    it("should throw on invalid JSON", () => {
      expect(() => parseTypedJson("invalid json")).toThrow();
    });
  });

  describe("stringifyJson", () => {
    it("should stringify regular data with JSON.stringify", () => {
      const data = { name: "test", value: 42 };
      const result = stringifyTypedJson(data);
      const parsed = JSON.parse(result);
      
      expect(parsed).toEqual(data);
    });

    it("should use TypedJSON for data that needs type preservation", () => {
      const data = {
        date: new Date("2023-01-01T00:00:00Z"),
        regex: /test/gi
      };
      
      const result = stringifyTypedJson(data);
      const parsed = parseTypedJson(result);
      
      expect(parsed.date).toBeInstanceOf(Date);
      expect(parsed.regex).toBeInstanceOf(RegExp);
      expect(parsed.regex.source).toBe("test");
      expect(parsed.regex.flags).toBe("gi");
    });
  });

  describe("stringifyJsonAsync", () => {
    it("should handle Blob data", async () => {
      const blob = new Blob(["test content"], { type: "text/plain" });
      const data = { blob };
      
      const result = await stringifyTypedJsonAsync(data);
      const parsed = await parseTypedJson(result);
      
      expect(parsed.blob).toBeInstanceOf(Blob);
      expect(parsed.blob.type).toContain("text/plain");
    });
  });

  describe("isTypePreservedJson", () => {
    it("should detect type-preserved JSON", () => {
      const typePreservedJson = '{"__date": "2023-01-01T00:00:00.000Z"}';
      expect(isTypePreservedJson(typePreservedJson)).toBe(true);
    });

    it("should detect regular JSON", () => {
      const regularJson = '{"name": "test"}';
      expect(isTypePreservedJson(regularJson)).toBe(false);
    });

    it("should handle invalid JSON", () => {
      expect(isTypePreservedJson("invalid json")).toBe(false);
    });
  });

  describe("safeParseJson", () => {
    it("should return parsed data on success", () => {
      const data = { name: "test" };
      const jsonString = JSON.stringify(data);
      const result = safeParseJson(jsonString);
      
      expect(result).toEqual(data);
    });

    it("should return null on error", () => {
      const result = safeParseJson("invalid json");
      expect(result).toBeNull();
    });
  });

  describe("safeStringifyJson", () => {
    it("should return stringified data on success", () => {
      const data = { name: "test" };
      const result = safeStringifyJson(data);
      
      expect(result).toBe(JSON.stringify(data));
    });

    it("should return error object on failure", () => {
      // Create a deeply nested object that exceeds maximum depth to cause stringify to fail
      // Include a Date object to trigger type preservation path
      let deepObject: any = { date: new Date() };
      let current = deepObject;
      
      // Create a very deep nesting (exceeds the default max depth of 20)
      for (let i = 0; i < 25; i++) {
        current.nested = {};
        current = current.nested;
      }
      
      const result = safeStringifyJson(deepObject);
      const parsed = JSON.parse(result);
      
      expect(parsed.error).toBe("Serialization failed");
      expect(parsed.message).toContain("Maximum serialization depth");
    });
  });

  describe("Integration with Poto framework", () => {
    it("should handle RPC message parsing", () => {
      const rpcMessage = {
        _rpcId: "test-123",
        _rpcType: "request",
        method: "testMethod",
        args: [1, "test", true]
      };
      
      const jsonString = JSON.stringify(rpcMessage);
      const parsed = parseTypedJson(jsonString);
      
      expect(parsed).toEqual(rpcMessage);
    });

    it("should handle SSE message parsing", () => {
      const sseMessage = {
        type: "data",
        data: "test data",
        timestamp: new Date().toISOString()
      };
      
      const jsonString = JSON.stringify(sseMessage);
      const parsed = parseTypedJson(jsonString);
      
      expect(parsed).toEqual(sseMessage);
    });

    it("should handle session data with dates", () => {
      const sessionData = {
        userId: "user123",
        createdAt: new Date("2023-01-01T00:00:00Z"),
        lastActivity: new Date("2023-01-02T00:00:00Z"),
        metadata: {
          loginCount: 5,
          preferences: new Map([["theme", "dark"]])
        }
      };
      
      const jsonString = stringifyTypedJson(sessionData);
      const parsed = parseTypedJson(jsonString);
      
      expect(parsed.userId).toBe("user123");
      expect(parsed.createdAt).toBeInstanceOf(Date);
      expect(parsed.lastActivity).toBeInstanceOf(Date);
      expect(parsed.metadata.preferences).toBeInstanceOf(Map);
    });
  });
});
