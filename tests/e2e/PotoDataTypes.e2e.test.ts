import { describe, beforeAll, afterAll, beforeEach, test as it, expect } from "bun:test";
import path from "path";
import { PotoServer } from "../../src/server/PotoServer";
import { PotoUser, UserProvider } from "../../src/server/UserProvider";
import { PotoClient } from "../../src/web/rpc/PotoClient";
import { PotoDataTypesTestModule } from "./PotoDataTypesTestModule";

// Helper to generate random port in safe range
function getRandomPort(): number {
    // Use range 30000-60000 to avoid well-known and registered ports
    return Math.floor(Math.random() * 30000) + 30000;
}

describe("PotoDataTypes E2E Round-Trip Tests", () => {
    // Increase timeout for CI environment
    const timeout = process.env.CI ? 30000 : 10000; // 30s in CI, 10s locally
    let server: PotoServer;
    let client: PotoClient;
    let serverUrl: string;
    const testPort = getRandomPort(); // Use random port to avoid conflicts

    function makeProxy(theClient: PotoClient) {
        return theClient.getProxy<PotoDataTypesTestModule>(PotoDataTypesTestModule.name);
    }

    beforeAll(async () => {
        // Create and start the server
        server = new PotoServer({
            port: testPort,
            staticDir: path.resolve(__dirname, "../../../public"),
            jwtSecret: "e2e-test-secret"
        });

        // Set up user provider
        server.setUserProvider({
            async findUserByUserId(userId: string) {
                return new PotoUser(userId, "hash", ["user"]);
            },
            async addUser(user: PotoUser): Promise<boolean> {
                return true;
            }
        } as UserProvider);

        // Add the data types test module
        server.addModule(new PotoDataTypesTestModule());

        // Start the server using the run() method
        server.run();

        // Use the assigned test port
        serverUrl = `http://localhost:${testPort}`;

        // Wait for server to start with retry logic
        let retries = 0;
        const maxRetries = process.env.CI ? 20 : 10; // More retries in CI
        const retryDelay = process.env.CI ? 500 : 200; // Longer delay in CI

        while (retries < maxRetries) {
            try {
                // Try to connect to the server
                const response = await fetch(serverUrl, {
                    method: 'GET',
                    signal: AbortSignal.timeout(2000) // 2 second timeout
                });

                if (response.ok || response.status === 404) { // 404 is fine, means server is running
                    break;
                }
            } catch (error) {
                // Server not ready yet, continue waiting
                if (retries === maxRetries - 1) {
                    console.error(`Server failed to start after ${maxRetries} attempts`);
                    console.error(`Final error: ${error}`);
                    throw new Error(`Server failed to start after ${maxRetries} attempts: ${error}`);
                }
            }

            retries++;
            if (retries < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }

        if (retries >= maxRetries) {
            throw new Error(`Server failed to start after ${maxRetries} attempts`);
        }

        // Create mock storage for testing
        const mockStorage = {
            getItem: (key: string): string | null => null,
            setItem: (key: string, value: string): void => { },
            removeItem: (key: string): void => { }
        };

        // Create client and login as visitor
        client = new PotoClient(serverUrl, mockStorage);
        try {
            await client.loginAsVisitor();
        } catch (error) {
            console.warn("Login failed, continuing without auth:", error);
        }
    });

    afterAll(async () => {
        // Clean up server to prevent port conflicts and resource leaks
        if (server?.server) {
            server.server.stop();
        }
    });

    beforeEach(async () => {
        // Create mock storage for testing
        const mockStorage = {
            getItem: (key: string): string | null => null,
            setItem: (key: string, value: string): void => { },
            removeItem: (key: string): void => { }
        };

        // Create a fresh client for each test to avoid state pollution
        client = new PotoClient(serverUrl, mockStorage);
        try {
            await client.loginAsVisitor();
        } catch (error) {
            console.warn("Login failed, continuing without auth:", error);
        }
    });

    describe("Primitive Data Types", () => {
        it("should handle primitive types correctly", async () => {
            const proxy = makeProxy(client);
            
            const testData = {
                string: "Hello, World!",
                number: 42,
                boolean: true,
                nullValue: null,
                undefinedValue: undefined
            };

            const result = await proxy.postTestPrimitives_(testData);

            expect(result.string).toBe("Hello, World!");
            expect(result.number).toBe(42);
            expect(result.boolean).toBe(true);
            expect(result.nullValue).toBeNull();
            expect(result.undefinedValue).toBeUndefined();
        }, timeout);

        it("should handle special number values", async () => {
            const proxy = makeProxy(client);
            
            const testData = {
                infinity: Infinity,
                negativeInfinity: -Infinity,
                notANumber: NaN,
                negativeZero: -0,
                largeNumber: 9007199254740993 // Beyond safe integer range
            };

            const result = await proxy.postTestSpecialNumbers_(testData);

            expect(result.infinity).toBe(Infinity);
            expect(result.negativeInfinity).toBe(-Infinity);
            expect(Number.isNaN(result.notANumber)).toBe(true);
            expect(result.negativeZero).toBe(-0);
            expect(result.largeNumber).toBe(9007199254740993);
        }, timeout);
    });

    describe("Date Objects", () => {
        it("should handle Date objects correctly", async () => {
            const proxy = makeProxy(client);
            
            const testData = {
                date: new Date("2023-01-01T12:00:00.000Z"),
                dateString: "2023-06-15T18:30:45.123Z",
                timestamp: 1672531200000,
                invalidDate: new Date("invalid")
            };

            const result = await proxy.postTestDates_(testData);

            expect(result.date).toBeInstanceOf(Date);
            expect(result.date.getTime()).toBe(new Date("2023-01-01T12:00:00.000Z").getTime());
            expect(result.dateString).toBe("2023-06-15T18:30:45.123Z");
            expect(result.timestamp).toBe(1672531200000);
            expect(result.invalidDate).toBeInstanceOf(Date);
            expect(Number.isNaN(result.invalidDate.getTime())).toBe(true);
        }, timeout);
    });

    describe("RegExp Objects", () => {
        it("should handle RegExp objects correctly", async () => {
            const proxy = makeProxy(client);
            
            const testData = {
                regex: /test/,
                globalRegex: /test/g,
                caseInsensitiveRegex: /test/i,
                multilineRegex: /test/m
            };

            const result = await proxy.postTestRegExp_(testData);

            expect(result.regex).toBeInstanceOf(RegExp);
            expect(result.regex.source).toBe("test");
            expect(result.regex.flags).toBe("");
            
            expect(result.globalRegex).toBeInstanceOf(RegExp);
            expect(result.globalRegex.flags).toBe("g");
            
            expect(result.caseInsensitiveRegex).toBeInstanceOf(RegExp);
            expect(result.caseInsensitiveRegex.flags).toBe("i");
            
            expect(result.multilineRegex).toBeInstanceOf(RegExp);
            expect(result.multilineRegex.flags).toBe("m");
        }, timeout);
    });

    describe("Map and Set Objects", () => {
        it("should handle Map and Set objects correctly", async () => {
            const proxy = makeProxy(client);
            
            const testData = {
                map: new Map<string, any>([
                    ["key1", "value1"],
                    ["key2", 42],
                    ["key3", true]
                ]),
                set: new Set(["item1", "item2", "item3"]),
                nestedMap: new Map([
                    ["outer1", new Map([["inner1", 1], ["inner2", 2]])],
                    ["outer2", new Map([["inner3", 3], ["inner4", 4]])]
                ]),
                nestedSet: new Set([
                    new Set(["a", "b"]),
                    new Set(["c", "d"])
                ])
            };

            const result = await proxy.postTestMapSet_(testData);

            expect(result.map).toBeInstanceOf(Map);
            expect(result.map.get("key1")).toBe("value1");
            expect(result.map.get("key2")).toBe(42);
            expect(result.map.get("key3")).toBe(true);

            expect(result.set).toBeInstanceOf(Set);
            expect(result.set.has("item1")).toBe(true);
            expect(result.set.has("item2")).toBe(true);
            expect(result.set.has("item3")).toBe(true);

            expect(result.nestedMap).toBeInstanceOf(Map);
            expect(result.nestedMap.get("outer1")).toBeInstanceOf(Map);
            expect(result.nestedMap.get("outer1")?.get("inner1")).toBe(1);

            expect(result.nestedSet).toBeInstanceOf(Set);
            expect(Array.from(result.nestedSet).every(item => item instanceof Set)).toBe(true);
        }, timeout);
    });

    describe("Error Objects", () => {
        it("should handle Error objects correctly", async () => {
            const proxy = makeProxy(client);
            
            const testData = {
                error: new Error("Test error"),
                customError: new Error("Custom error message"),
                errorWithStack: new Error("Error with stack")
            };

            const result = await proxy.postTestErrors_(testData);

            expect(result.error).toBeInstanceOf(Error);
            expect(result.error.message).toBe("Test error");
            
            expect(result.customError).toBeInstanceOf(Error);
            expect(result.customError.message).toBe("Custom error message");
            
            expect(result.errorWithStack).toBeInstanceOf(Error);
            expect(result.errorWithStack.message).toBe("Error with stack");
        }, timeout);
    });

    describe("URL Objects", () => {
        it("should handle URL objects correctly", async () => {
            const proxy = makeProxy(client);
            
            const testData = {
                url: new URL("https://example.com"),
                urlWithParams: new URL("https://example.com/path?param1=value1&param2=value2"),
                relativeUrl: new URL("/relative/path", "https://example.com")
            };

            const result = await proxy.postTestUrls_(testData);

            expect(result.url).toBeInstanceOf(URL);
            expect(result.url.href).toBe("https://example.com/");
            
            expect(result.urlWithParams).toBeInstanceOf(URL);
            expect(result.urlWithParams.searchParams.get("param1")).toBe("value1");
            
            expect(result.relativeUrl).toBeInstanceOf(URL);
            expect(result.relativeUrl.href).toBe("https://example.com/relative/path");
        }, timeout);
    });

    describe("ArrayBuffer and TypedArray", () => {
        it("should handle ArrayBuffer and TypedArray correctly", async () => {
            const proxy = makeProxy(client);
            
            const buffer = new ArrayBuffer(16);
            const uint8Array = new Uint8Array([1, 2, 3, 4, 5]);
            const int32Array = new Int32Array([100, 200, 300]);
            const float64Array = new Float64Array([1.1, 2.2, 3.3]);

            const testData = {
                buffer,
                uint8Array,
                int32Array,
                float64Array
            };

            const result = await proxy.postTestArrayBuffer_(testData);

            expect(result.buffer).toBeInstanceOf(ArrayBuffer);
            expect(result.buffer.byteLength).toBe(16);

            expect(result.uint8Array).toBeInstanceOf(Uint8Array);
            expect(Array.from(result.uint8Array)).toEqual([1, 2, 3, 4, 5]);

            expect(result.int32Array).toBeInstanceOf(Int32Array);
            expect(Array.from(result.int32Array)).toEqual([100, 200, 300]);

            expect(result.float64Array).toBeInstanceOf(Float64Array);
            expect(Array.from(result.float64Array)).toEqual([1.1, 2.2, 3.3]);
        }, timeout);
    });

    describe("Blob Objects", () => {
        it("should handle Blob objects correctly", async () => {
            const proxy = makeProxy(client);
            
            const testData = {
                textBlob: new Blob(["Hello, World!"], { type: "text/plain" }),
                jsonBlob: new Blob(['{"key": "value"}'], { type: "application/json" }),
                binaryBlob: new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: "application/octet-stream" }),
                emptyBlob: new Blob([], { type: "text/plain" })
            };

            const result = await proxy.postTestBlobs_(testData);

            expect(result.textBlob).toBeInstanceOf(Blob);
            expect(result.textBlob.type).toBe("text/plain;charset=utf-8");
            expect(result.textBlob.size).toBe(13);

            expect(result.jsonBlob).toBeInstanceOf(Blob);
            expect(result.jsonBlob.type).toBe("application/json;charset=utf-8");
            expect(result.jsonBlob.size).toBe(16);

            expect(result.binaryBlob).toBeInstanceOf(Blob);
            expect(result.binaryBlob.type).toBe("application/octet-stream");
            expect(result.binaryBlob.size).toBe(5);

            expect(result.emptyBlob).toBeInstanceOf(Blob);
            expect(result.emptyBlob.size).toBe(0);
        }, timeout);
    });

    describe("Complex Nested Objects", () => {
        it("should handle complex nested objects correctly", async () => {
            const proxy = makeProxy(client);
            
            const testData = {
                user: {
                    id: 123,
                    name: "John Doe",
                    profile: {
                        avatar: "https://example.com/avatar.jpg",
                        settings: {
                            theme: "dark",
                            notifications: true
                        },
                        createdAt: new Date("2023-01-01T00:00:00.000Z")
                    },
                    tags: ["admin", "user", "premium"],
                    metadata: new Map<string, any>([
                        ["lastLogin", new Date("2023-06-01T12:00:00.000Z")],
                        ["loginCount", 42],
                        ["preferences", { language: "en", timezone: "UTC" }]
                    ])
                },
                config: {
                    version: "1.0.0",
                    features: new Set(["feature1", "feature2", "feature3"]),
                    limits: {
                        maxUsers: 1000,
                        timeout: 30000
                    }
                }
            };

            const result = await proxy.postTestComplexObjects_(testData);

            expect(result.user.id).toBe(123);
            expect(result.user.name).toBe("John Doe");
            expect(result.user.profile.avatar).toBe("https://example.com/avatar.jpg");
            expect(result.user.profile.settings.theme).toBe("dark");
            expect(result.user.profile.settings.notifications).toBe(true);
            expect(result.user.profile.createdAt).toBeInstanceOf(Date);
            expect(result.user.tags).toEqual(["admin", "user", "premium"]);
            expect(result.user.metadata).toBeInstanceOf(Map);
            expect(result.user.metadata.get("loginCount")).toBe(42);

            expect(result.config.version).toBe("1.0.0");
            expect(result.config.features).toBeInstanceOf(Set);
            expect(result.config.features.has("feature1")).toBe(true);
            expect(result.config.limits.maxUsers).toBe(1000);
            expect(result.config.limits.timeout).toBe(30000);
        }, timeout);
    });

    describe("Mixed Arrays", () => {
        it("should handle arrays with mixed content correctly", async () => {
            const proxy = makeProxy(client);
            
            const testData = {
                mixedArray: [
                    "string",
                    42,
                    true,
                    new Date("2023-01-01T00:00:00.000Z"),
                    /test/gi,
                    null
                ],
                nestedArrays: [
                    ["a", "b", "c"],
                    [1, 2, 3],
                    ["x", "y", "z"]
                ],
                arrayWithObjects: [
                    {
                        id: 1,
                        data: "first",
                        timestamp: new Date("2023-01-01T00:00:00.000Z")
                    },
                    {
                        id: 2,
                        data: "second",
                        timestamp: new Date("2023-01-02T00:00:00.000Z")
                    }
                ]
            };

            const result = await proxy.postTestMixedArrays_(testData);

            expect(Array.isArray(result.mixedArray)).toBe(true);
            expect(result.mixedArray[0]).toBe("string");
            expect(result.mixedArray[1]).toBe(42);
            expect(result.mixedArray[2]).toBe(true);
            expect(result.mixedArray[3]).toBeInstanceOf(Date);
            expect(result.mixedArray[4]).toBeInstanceOf(RegExp);
            expect(result.mixedArray[5]).toBeNull();

            expect(Array.isArray(result.nestedArrays)).toBe(true);
            expect(result.nestedArrays[0]).toEqual(["a", "b", "c"]);
            expect(result.nestedArrays[1]).toEqual([1, 2, 3]);
            expect(result.nestedArrays[2]).toEqual(["x", "y", "z"]);

            expect(Array.isArray(result.arrayWithObjects)).toBe(true);
            expect(result.arrayWithObjects[0].id).toBe(1);
            expect(result.arrayWithObjects[0].data).toBe("first");
            expect(result.arrayWithObjects[0].timestamp).toBeInstanceOf(Date);
        }, timeout);
    });

    describe("Circular References", () => {
        it("should handle circular references gracefully", async () => {
            const proxy = makeProxy(client);
            
            // Create circular reference
            const circularObj: any = {
                name: "test",
                data: "some data"
            };
            circularObj.self = circularObj;

            const result = await proxy.postTestCircularReferences_(circularObj);

            expect(result.name).toBe("test");
            expect(result.data).toBe("some data");
            // Circular reference should be handled gracefully
            expect(result.self).toBeDefined();
        }, timeout);
    });

    describe("Large Data Structures", () => {
        it("should handle large data structures", async () => {
            const proxy = makeProxy(client);
            
            const largeArray = Array.from({ length: 1000 }, (_, i) => i);
            const largeObject = Object.fromEntries(
                Array.from({ length: 100 }, (_, i) => [`key${i}`, `value${i}`])
            );
            const largeString = "x".repeat(10000);

            const testData = {
                largeArray,
                largeObject,
                largeString
            };

            const result = await proxy.postTestLargeData_(testData);

            expect(Array.isArray(result.largeArray)).toBe(true);
            expect(result.largeArray.length).toBe(1000);
            expect(result.largeArray[0]).toBe(0);
            expect(result.largeArray[999]).toBe(999);

            expect(typeof result.largeObject).toBe("object");
            expect(Object.keys(result.largeObject).length).toBe(100);
            expect(result.largeObject.key0).toBe("value0");
            expect(result.largeObject.key99).toBe("value99");

            expect(typeof result.largeString).toBe("string");
            expect(result.largeString.length).toBe(10000);
        }, timeout);
    });

    describe("Edge Cases", () => {
        it("should handle edge cases correctly", async () => {
            const proxy = makeProxy(client);
            
            const testData = {
                emptyString: "",
                whitespaceString: "   \t\n   ",
                unicodeString: "Hello 世界 🌍",
                emptyArray: [],
                emptyObject: {},
                zeroLengthBuffer: new ArrayBuffer(0)
            };

            const result = await proxy.postTestEdgeCases_(testData);

            expect(result.emptyString).toBe("");
            expect(result.whitespaceString).toBe("   \t\n   ");
            expect(result.unicodeString).toBe("Hello 世界 🌍");
            expect(Array.isArray(result.emptyArray)).toBe(true);
            expect(result.emptyArray.length).toBe(0);
            expect(typeof result.emptyObject).toBe("object");
            expect(Object.keys(result.emptyObject).length).toBe(0);
            expect(result.zeroLengthBuffer).toBeInstanceOf(ArrayBuffer);
            expect(result.zeroLengthBuffer.byteLength).toBe(0);
        }, timeout);
    });

    describe("Function and Symbol Handling", () => {
        it("should handle functions gracefully", async () => {
            const proxy = makeProxy(client);
            
            const testData = {
                simpleFunction: function() { return "hello"; },
                arrowFunction: () => "world",
                asyncFunction: async () => "async"
            };

            const result = await proxy.postTestFunctions_(testData);

            // Functions should be handled gracefully (likely serialized as null)
            expect(result.simpleFunction).toBeNull();
            expect(result.arrowFunction).toBeNull();
            expect(result.asyncFunction).toBeNull();
        }, timeout);

        it("should handle symbols gracefully", async () => {
            const proxy = makeProxy(client);
            
            const testData = {
                symbol: Symbol("test"),
                symbolWithDescription: Symbol("description")
            };

            const result = await proxy.postTestSymbols_(testData);

            // Symbols should be handled gracefully (likely serialized as null)
            expect(result.symbol).toBeNull();
            expect(result.symbolWithDescription).toBeNull();
        }, timeout);
    });

    describe("BigInt Support", () => {
        it("should handle BigInt values correctly", async () => {
            const proxy = makeProxy(client);
            
            const testData = {
                bigInt: BigInt(123),
                largeBigInt: BigInt("9007199254740993"),
                negativeBigInt: BigInt(-456)
            };

            const result = await proxy.postTestBigInt_(testData);

            expect(typeof result.bigInt).toBe("bigint");
            expect(result.bigInt).toBe(BigInt(123));
            expect(typeof result.largeBigInt).toBe("bigint");
            expect(result.largeBigInt).toBe(BigInt("9007199254740993"));
            expect(typeof result.negativeBigInt).toBe("bigint");
            expect(result.negativeBigInt).toBe(BigInt(-456));
        }, timeout);
    });

    describe("Property Order Preservation", () => {
        it("should preserve property order", async () => {
            const proxy = makeProxy(client);
            
            const testData = {
                z: "last",
                a: "first",
                m: "middle",
                b: "second",
                y: "second-to-last"
            };

            const result = await proxy.postTestPropertyOrder_(testData);

            const originalKeys = Object.keys(testData);
            const resultKeys = Object.keys(result);

            expect(resultKeys).toEqual(originalKeys);
            expect(result.z).toBe("last");
            expect(result.a).toBe("first");
            expect(result.m).toBe("middle");
            expect(result.b).toBe("second");
            expect(result.y).toBe("second-to-last");
        }, timeout);
    });

    describe("Multiple Round-Trip Cycles", () => {
        it("should handle multiple serialization cycles", async () => {
            const proxy = makeProxy(client);
            
            const testData = {
                string: "test",
                number: 42,
                date: new Date("2023-01-01T00:00:00.000Z"),
                array: [1, 2, 3],
                object: { key: "value" }
            };

            const result = await proxy.postTestMultipleRounds_(testData, 3);

            expect(result.string).toBe("test");
            expect(result.number).toBe(42);
            expect(result.date).toBeInstanceOf(Date);
            expect(Array.isArray(result.array)).toBe(true);
            expect(result.array).toEqual([1, 2, 3]);
            expect(typeof result.object).toBe("object");
            expect(result.object.key).toBe("value");
        }, timeout);
    });

    describe("Performance Tests", () => {
        it("should handle performance tests", async () => {
            const proxy = makeProxy(client);
            
            const result = await proxy.postTestPerformance_(1000);

            expect(result.arraySize).toBe(1000);
            expect(result.objectSize).toBe(1000);
            expect(result.stringSize).toBe(1000);
            expect(typeof result.processingTime).toBe("number");
            expect(result.processingTime).toBeGreaterThanOrEqual(0);
        }, timeout);
    });

    describe("Memory Safety", () => {
        it("should handle memory safety tests", async () => {
            const proxy = makeProxy(client);
            
            const testData = {
                normalData: { key: "value" },
                deepNesting: { level1: { level2: { level3: { level4: "deep" } } } },
                largeBuffer: new ArrayBuffer(1024)
            };

            const result = await proxy.postTestMemorySafety_(testData);

            expect(result.normalDataProcessed).toBe(true);
            expect(result.deepNestingProcessed).toBe(true);
            expect(result.largeBufferProcessed).toBe(true);
        }, timeout);
    });

    describe("Comprehensive Round-Trip Tests", () => {
        it("should handle comprehensive data type round-trips", async () => {
            const proxy = makeProxy(client);
            
            // Test a comprehensive object with all major data types
            const comprehensiveData = {
                // Primitives
                string: "Hello, World!",
                number: 42,
                boolean: true,
                nullValue: null,
                undefinedValue: undefined,
                
                // Special numbers
                infinity: Infinity,
                negativeInfinity: -Infinity,
                notANumber: NaN,
                negativeZero: -0,
                largeNumber: 9007199254740993,
                
                // Objects
                date: new Date("2023-01-01T12:00:00.000Z"),
                regex: /test/gi,
                map: new Map([["key", "value"]]),
                set: new Set(["item1", "item2"]),
                error: new Error("Test error"),
                url: new URL("https://example.com"),
                buffer: new ArrayBuffer(8),
                blob: new Blob(["test"], { type: "text/plain" }),
                bigInt: BigInt(123),
                
                // Arrays
                array: [1, 2, 3, "string", true, null],
                nestedArray: [[1, 2], [3, 4], ["a", "b"]],
                
                // Objects
                object: { key: "value", nested: { deep: "value" } },
                mixedObject: {
                    string: "test",
                    number: 42,
                    date: new Date("2023-01-01T00:00:00.000Z"),
                    array: [1, 2, 3],
                    map: new Map([["nested", "value"]])
                }
            };

            // Test each data type individually
            const primitiveResult = await proxy.postTestPrimitives_({
                string: comprehensiveData.string,
                number: comprehensiveData.number,
                boolean: comprehensiveData.boolean,
                nullValue: comprehensiveData.nullValue,
                undefinedValue: comprehensiveData.undefinedValue
            });

            expect(primitiveResult.string).toBe(comprehensiveData.string);
            expect(primitiveResult.number).toBe(comprehensiveData.number);
            expect(primitiveResult.boolean).toBe(comprehensiveData.boolean);
            expect(primitiveResult.nullValue).toBeNull();
            expect(primitiveResult.undefinedValue).toBeUndefined();

            const specialNumbersResult = await proxy.postTestSpecialNumbers_({
                infinity: comprehensiveData.infinity,
                negativeInfinity: comprehensiveData.negativeInfinity,
                notANumber: comprehensiveData.notANumber,
                negativeZero: comprehensiveData.negativeZero,
                largeNumber: comprehensiveData.largeNumber
            });

            expect(specialNumbersResult.infinity).toBe(Infinity);
            expect(specialNumbersResult.negativeInfinity).toBe(-Infinity);
            expect(Number.isNaN(specialNumbersResult.notANumber)).toBe(true);
            expect(specialNumbersResult.negativeZero).toBe(-0);
            expect(specialNumbersResult.largeNumber).toBe(9007199254740993);

            const dateResult = await proxy.postTestDates_({
                date: comprehensiveData.date,
                dateString: "2023-01-01T12:00:00.000Z",
                timestamp: 1672531200000,
                invalidDate: new Date("invalid")
            });

            expect(dateResult.date).toBeInstanceOf(Date);
            expect(dateResult.date.getTime()).toBe(comprehensiveData.date.getTime());

            const regexResult = await proxy.postTestRegExp_({
                regex: comprehensiveData.regex,
                globalRegex: /test/g,
                caseInsensitiveRegex: /test/i,
                multilineRegex: /test/m
            });

            expect(regexResult.regex).toBeInstanceOf(RegExp);
            expect(regexResult.regex.source).toBe("test");
            expect(regexResult.regex.flags).toBe("gi");

            const mapSetResult = await proxy.postTestMapSet_({
                map: comprehensiveData.map,
                set: comprehensiveData.set,
                nestedMap: new Map([["outer", new Map([["inner", 42]])]]),
                nestedSet: new Set([new Set(["a", "b"])])
            });

            expect(mapSetResult.map).toBeInstanceOf(Map);
            expect(mapSetResult.map.get("key")).toBe("value");
            expect(mapSetResult.set).toBeInstanceOf(Set);
            expect(mapSetResult.set.has("item1")).toBe(true);

            const errorResult = await proxy.postTestErrors_({
                error: comprehensiveData.error,
                customError: new Error("Custom error"),
                errorWithStack: new Error("Error with stack")
            });

            expect(errorResult.error).toBeInstanceOf(Error);
            expect(errorResult.error.message).toBe("Test error");

            const urlResult = await proxy.postTestUrls_({
                url: comprehensiveData.url,
                urlWithParams: new URL("https://example.com?param=value"),
                relativeUrl: new URL("/path", "https://example.com")
            });

            expect(urlResult.url).toBeInstanceOf(URL);
            expect(urlResult.url.href).toBe("https://example.com/");

            const bufferResult = await proxy.postTestArrayBuffer_({
                buffer: comprehensiveData.buffer,
                uint8Array: new Uint8Array([1, 2, 3, 4]),
                int32Array: new Int32Array([100, 200]),
                float64Array: new Float64Array([1.1, 2.2])
            });

            expect(bufferResult.buffer).toBeInstanceOf(ArrayBuffer);
            expect(bufferResult.uint8Array).toBeInstanceOf(Uint8Array);

            const blobResult = await proxy.postTestBlobs_({
                textBlob: comprehensiveData.blob,
                jsonBlob: new Blob(['{"key": "value"}'], { type: "application/json" }),
                binaryBlob: new Blob([new Uint8Array([1, 2, 3])], { type: "application/octet-stream" }),
                emptyBlob: new Blob([], { type: "text/plain" })
            });

            expect(blobResult.textBlob).toBeInstanceOf(Blob);
            expect(blobResult.textBlob.type).toBe("text/plain;charset=utf-8");

            const bigIntResult = await proxy.postTestBigInt_({
                bigInt: comprehensiveData.bigInt,
                largeBigInt: BigInt("9007199254740993"),
                negativeBigInt: BigInt(-456)
            });

            expect(typeof bigIntResult.bigInt).toBe("bigint");
            expect(bigIntResult.bigInt).toBe(BigInt(123));

        }, timeout);
    });

    describe("Binary Data Streaming with Generators", () => {
        it("should stream ArrayBuffer chunks via generator", async () => {
            const proxy = makeProxy(client);
            
            const chunks: ArrayBuffer[] = [];
            const chunkCount = 5000;
            const chunkSize = 6400;
            
            try {
                const stream: AsyncGenerator<ArrayBuffer, void, unknown> = await proxy.streamBinaryChunks_(chunkCount, chunkSize);
                
                for await (const chunk of stream) {
                    // console.log('Received chunk:', chunk);
                    // console.log('Chunk type:', Object.prototype.toString.call(chunk));
                    // console.log('Is ArrayBuffer?', chunk instanceof ArrayBuffer);
                    // console.log('Chunk constructor:', chunk?.constructor?.name);
                    
                    expect(chunk).toBeInstanceOf(ArrayBuffer);
                    expect(chunk.byteLength).toBe(chunkSize);
                    
                    chunks.push(chunk);
                }
                
                expect(chunks.length).toBe(chunkCount);
                
                // Verify content integrity
                for (let i = 0; i < chunks.length; i++) {
                    const view = new Uint8Array(chunks[i]);
                    for (let j = 0; j < 8; j++) {
                        expect(view[j]).toBe((i * 8 + j) % 256);
                    }
                }
            } catch (error) {
                console.error('❌ BUG CONFIRMED: Failed to stream ArrayBuffer chunks:', error);
                throw error;
            }
        }, 1000);

        it("should stream Uint8Array chunks via generator", async () => {
            const proxy = makeProxy(client);
            
            const chunks: Uint8Array[] = [];
            const chunkCount = 5000;
            const chunkSize = 6400;
            
            try {
                const stream = await proxy.streamUint8ArrayChunks_(chunkCount, chunkSize);
                
                for await (const chunk of stream) {
                    // console.log('Received Uint8Array chunk:', chunk);
                    // console.log('Chunk type:', Object.prototype.toString.call(chunk));
                    // console.log('Is Uint8Array?', chunk instanceof Uint8Array);
                    // console.log('Chunk constructor:', chunk?.constructor?.name);
                    
                    expect(chunk).toBeInstanceOf(Uint8Array);
                    expect(chunk.length).toBe(chunkSize);
                    
                    chunks.push(chunk);
                }
                
                expect(chunks.length).toBe(chunkCount);
                
                // Verify content integrity
                for (let i = 0; i < chunks.length; i++) {
                    for (let j = 0; j < 8; j++) {
                        expect(chunks[i][j]).toBe((i * 8 + j) % 256);
                    }
                }
            } catch (error) {
                console.error('❌ BUG CONFIRMED: Failed to stream Uint8Array chunks:', error);
                throw error;
            }
        }, 1000);

        it("should stream Blob chunks via generator", async () => {
            const proxy = makeProxy(client);
            
            const chunks: Blob[] = [];
            const chunkCount = 5;
            
            try {
                const stream = await proxy.streamBlobChunks_(chunkCount);
                
                for await (const chunk of stream) {
                    // console.log('Received Blob chunk:', chunk);
                    // console.log('Chunk type:', Object.prototype.toString.call(chunk));
                    // console.log('Is Blob?', chunk instanceof Blob);
                    // console.log('Chunk constructor:', chunk?.constructor?.name);
                    // console.log('Chunk size:', chunk?.size);
                    
                    // This is where we expect to see the bug
                    expect(chunk).toBeInstanceOf(Blob);
                    expect(chunk.size).toBe(8);
                    expect(chunk.type).toBe('application/octet-stream');
                    
                    chunks.push(chunk);
                }
                
                expect(chunks.length).toBe(chunkCount);
                
                // Verify content integrity
                for (let i = 0; i < chunks.length; i++) {
                    const arrayBuffer = await chunks[i].arrayBuffer();
                    const view = new Uint8Array(arrayBuffer);
                    for (let j = 0; j < 8; j++) {
                        expect(view[j]).toBe((i * 8 + j) % 256);
                    }
                }
            } catch (error) {
                console.error('❌ BUG CONFIRMED: Failed to stream Blob chunks:', error);
                throw error;
            }
        }, timeout);

        it("should handle mixed binary data types in generator", async () => {
            const proxy = makeProxy(client);
            
            // Try with ArrayBuffer first
            const arrayBufferChunks: ArrayBuffer[] = [];
            const stream1 = await proxy.streamBinaryChunks_(3, 6400);
            
            for await (const chunk of stream1) {
                arrayBufferChunks.push(chunk);
            }
            
            expect(arrayBufferChunks.length).toBe(3);
            
            // Then try with Uint8Array
            const uint8Chunks: Uint8Array[] = [];
            const stream2 = await proxy.streamUint8ArrayChunks_(3, 6400);
            
            for await (const chunk of stream2) {
                uint8Chunks.push(chunk);
            }
            
            expect(uint8Chunks.length).toBe(3);
            
            // Finally try with Blob
            const blobChunks: Blob[] = [];
            const stream3 = await proxy.streamBlobChunks_(3);
            
            for await (const chunk of stream3) {
                blobChunks.push(chunk);
            }
            
            expect(blobChunks.length).toBe(3);
        }, timeout);
    });
});
