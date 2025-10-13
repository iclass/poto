import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { PotoClient } from "../../../src/web/rpc/PotoClient";

describe("PotoClient Method Override Tests - GET/DELETE with Arguments", () => {
    let client: PotoClient;
    let mockStorage: any;
    let capturedRequests: Array<{ method: string; url: string; body?: any }> = [];
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
        // Save the original fetch function
        originalFetch = global.fetch;
        
        // Reset captured requests
        capturedRequests = [];
        
        // Create mock storage
        mockStorage = {
            data: new Map<string, string>(),
            getItem(key: string): string | null {
                return this.data.get(key) || null;
            },
            setItem(key: string, value: string): void {
                this.data.set(key, value);
            },
            removeItem(key: string): void {
                this.data.delete(key);
            }
        };

        // Create client with mock storage
        client = new PotoClient("http://localhost:3000", mockStorage);
        
        // Mock fetch to capture requests
        global.fetch = async (url: string | URL, options?: RequestInit) => {
            const requestUrl = typeof url === 'string' ? url : url.toString();
            capturedRequests.push({
                method: options?.method || 'GET',
                url: requestUrl,
                body: options?.body
            });
            
            // Return a mock successful response
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        };
    });

    afterEach(() => {
        // Restore the original fetch function to prevent interference with other tests
        global.fetch = originalFetch;
    });

    test("should use GET method for methods starting with 'get' when no arguments", async () => {
        const proxy = client.getProxy<{
            getData(): Promise<any>;
        }>("test");
        
        await proxy.getData();
        
        expect(capturedRequests).toHaveLength(1);
        expect(capturedRequests[0].method).toBe("GET");
        expect(capturedRequests[0].url).toContain("/test/data");
    });

    test("should force POST method for 'get' methods with any arguments", async () => {
        const proxy = client.getProxy<{
            getData(id: number): Promise<any>;
        }>("test");
        
        await proxy.getData(123);
        
        expect(capturedRequests).toHaveLength(1);
        expect(capturedRequests[0].method).toBe("POST");
        expect(capturedRequests[0].url).toContain("/test/getdata");
        expect(capturedRequests[0].body).toBeDefined();
    });

    test("should force POST method for 'get' methods when Uint8Array is present", async () => {
        const proxy = client.getProxy<{
            getImageSize(imageData: Uint8Array): Promise<any>;
        }>("test");
        
        const imageData = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        await proxy.getImageSize(imageData);
        
        expect(capturedRequests).toHaveLength(1);
        expect(capturedRequests[0].method).toBe("POST");
        expect(capturedRequests[0].url).toContain("/test/getimagesize");
        expect(capturedRequests[0].body).toBeDefined();
    });

    test("should force POST method for 'get' methods when ArrayBuffer is present", async () => {
        const proxy = client.getProxy<{
            getBufferData(buffer: ArrayBuffer): Promise<any>;
        }>("test");
        
        const buffer = new ArrayBuffer(8);
        await proxy.getBufferData(buffer);
        
        expect(capturedRequests).toHaveLength(1);
        expect(capturedRequests[0].method).toBe("POST");
        expect(capturedRequests[0].url).toContain("/test/getbufferdata");
        expect(capturedRequests[0].body).toBeDefined();
    });

    test("should force POST method for 'get' methods when Blob is present", async () => {
        const proxy = client.getProxy<{
            getBlobData(blob: Blob): Promise<any>;
        }>("test");
        
        const blob = new Blob(["test data"], { type: "text/plain" });
        await proxy.getBlobData(blob);
        
        expect(capturedRequests).toHaveLength(1);
        expect(capturedRequests[0].method).toBe("POST");
        expect(capturedRequests[0].url).toContain("/test/getblobdata");
        expect(capturedRequests[0].body).toBeDefined();
    });

    test("should force POST method for 'get' methods when DataView is present", async () => {
        const proxy = client.getProxy<{
            getDataView(view: DataView): Promise<any>;
        }>("test");
        
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        await proxy.getDataView(view);
        
        expect(capturedRequests).toHaveLength(1);
        expect(capturedRequests[0].method).toBe("POST");
        expect(capturedRequests[0].url).toContain("/test/getdataview");
        expect(capturedRequests[0].body).toBeDefined();
    });

    test("should force POST method for 'delete' methods with any arguments", async () => {
        const proxy = client.getProxy<{
            deleteFile(id: number): Promise<any>;
        }>("test");
        
        await proxy.deleteFile(123);
        
        expect(capturedRequests).toHaveLength(1);
        expect(capturedRequests[0].method).toBe("POST");
        expect(capturedRequests[0].url).toContain("/test/deletefile");
        expect(capturedRequests[0].body).toBeDefined();
    });

    test("should use DELETE method for 'delete' methods with no arguments", async () => {
        const proxy = client.getProxy<{
            deleteAll(): Promise<any>;
        }>("test");
        
        await proxy.deleteAll();
        
        expect(capturedRequests).toHaveLength(1);
        expect(capturedRequests[0].method).toBe("DELETE");
        expect(capturedRequests[0].url).toContain("/test/all");
    });

    test("should not override POST methods even with binary data", async () => {
        const proxy = client.getProxy<{
            postData(data: Uint8Array): Promise<any>;
        }>("test");
        
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        await proxy.postData(data);
        
        expect(capturedRequests).toHaveLength(1);
        expect(capturedRequests[0].method).toBe("POST");
        expect(capturedRequests[0].url).toContain("/test/data");
        expect(capturedRequests[0].body).toBeDefined();
    });

    test("should not override PUT methods even with binary data", async () => {
        const proxy = client.getProxy<{
            putData(data: Uint8Array): Promise<any>;
        }>("test");
        
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        await proxy.putData(data);
        
        expect(capturedRequests).toHaveLength(1);
        expect(capturedRequests[0].method).toBe("PUT");
        expect(capturedRequests[0].url).toContain("/test/data");
        expect(capturedRequests[0].body).toBeDefined();
    });

    test("should detect binary data in nested objects", async () => {
        const proxy = client.getProxy<{
            getNestedData(data: { image: Uint8Array; metadata: string }): Promise<any>;
        }>("test");
        
        const data = {
            image: new Uint8Array([1, 2, 3, 4, 5]),
            metadata: "test"
        };
        await proxy.getNestedData(data);
        
        expect(capturedRequests).toHaveLength(1);
        expect(capturedRequests[0].method).toBe("POST");
        expect(capturedRequests[0].url).toContain("/test/getnesteddata");
        expect(capturedRequests[0].body).toBeDefined();
    });

    test("should detect binary data in arrays", async () => {
        const proxy = client.getProxy<{
            getArrayData(images: Uint8Array[]): Promise<any>;
        }>("test");
        
        const images = [
            new Uint8Array([1, 2, 3]),
            new Uint8Array([4, 5, 6])
        ];
        await proxy.getArrayData(images);
        
        expect(capturedRequests).toHaveLength(1);
        expect(capturedRequests[0].method).toBe("POST");
        expect(capturedRequests[0].url).toContain("/test/getarraydata");
        expect(capturedRequests[0].body).toBeDefined();
    });

    test("should handle methods without HTTP verb prefix", async () => {
        const proxy = client.getProxy<{
            processData(data: Uint8Array): Promise<any>;
        }>("test");
        
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        await proxy.processData(data);
        
        expect(capturedRequests).toHaveLength(1);
        expect(capturedRequests[0].method).toBe("POST");
        expect(capturedRequests[0].url).toContain("/test/processdata");
        expect(capturedRequests[0].body).toBeDefined();
    });

    test("should handle mixed arguments with and without binary data", async () => {
        const proxy = client.getProxy<{
            getMixedData(id: number, image: Uint8Array, name: string): Promise<any>;
        }>("test");
        
        const image = new Uint8Array([1, 2, 3, 4, 5]);
        await proxy.getMixedData(123, image, "test");
        
        expect(capturedRequests).toHaveLength(1);
        expect(capturedRequests[0].method).toBe("POST");
        expect(capturedRequests[0].url).toContain("/test/getmixeddata");
        expect(capturedRequests[0].body).toBeDefined();
    });
});

describe("PotoClient _hasBlob Performance Tests", () => {
    let client: PotoClient;
    let mockStorage: any;
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
        // Save the original fetch function
        originalFetch = global.fetch;
        
        // Create mock storage
        mockStorage = {
            data: new Map<string, string>(),
            getItem(key: string): string | null {
                return this.data.get(key) || null;
            },
            setItem(key: string, value: string): void {
                this.data.set(key, value);
            },
            removeItem(key: string): void {
                this.data.delete(key);
            }
        };

        client = new PotoClient("http://localhost:3000", mockStorage);
        
        // Mock fetch to return quickly
        global.fetch = async () => {
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        };
    });

    afterEach(() => {
        // Restore the original fetch function to prevent interference with other tests
        global.fetch = originalFetch;
    });

    test("should NOT iterate through TypedArray elements when checking for Blobs (OPTIMIZATION)", async () => {
        // This test verifies the _hasBlob optimization for large TypedArrays
        
        const proxy = client.getProxy<{
            uploadImage(imageData: Uint8Array): Promise<any>;
        }>("test");
        
        // Large TypedArray similar to real-world image upload (2MB)
        const largeImage = new Uint8Array(2 * 1024 * 1024);
        for (let i = 0; i < Math.min(1000, largeImage.length); i++) {
            largeImage[i] = i % 256;
        }

        const startTime = performance.now();
        await proxy.uploadImage(largeImage);
        const endTime = performance.now();

        const totalTime = endTime - startTime;
        
        // With the optimization, this should complete very quickly (~2-5ms)
        // The _hasBlob check now skips TypedArray elements (no iteration)
        // Base64 encoding uses native Buffer.toString() in Bun/Node (~0.7ms for 2MB)
        expect(totalTime).toBeLessThan(50); // Should be ~2-5ms, 50ms generous for CI
    });

    test("should still detect actual Blobs in nested structures", async () => {
        const proxy = client.getProxy<{
            getData(data: { file: Blob; metadata: string }): Promise<any>;
        }>("test");
        
        const blob = new Blob(['test content'], { type: 'text/plain' });
        const data = {
            file: blob,
            metadata: 'test'
        };

        // Should detect the Blob and use async serialization
        // This is verified by the fact it doesn't throw an error
        await expect(proxy.getData(data)).resolves.toBeDefined();
    });

    test("should handle mixed TypedArrays and Blobs correctly", async () => {
        const proxy = client.getProxy<{
            uploadMixed(image: Uint8Array, thumbnail: Blob): Promise<any>;
        }>("test");
        
        const image = new Uint8Array(1024);
        const thumbnail = new Blob(['thumb'], { type: 'image/png' });

        // Should detect the Blob (not be confused by TypedArray)
        await expect(proxy.uploadMixed(image, thumbnail)).resolves.toBeDefined();
    });

    test("should handle large TypedArray in array without performance degradation", async () => {
        const proxy = client.getProxy<{
            processImages(images: Uint8Array[]): Promise<any>;
        }>("test");
        
        // Multiple large images
        const images = [
            new Uint8Array(500 * 1024), // 500KB each
            new Uint8Array(500 * 1024),
            new Uint8Array(500 * 1024)
        ];

        const startTime = performance.now();
        await proxy.processImages(images);
        const endTime = performance.now();

        const totalTime = endTime - startTime;
        
        // Should complete very quickly even with multiple large arrays (1.5MB total)
        // Each array uses native Buffer encoding (~0.1-0.2ms each)
        expect(totalTime).toBeLessThan(50); // Should be ~1-2ms, 50ms generous for CI
    });

    test("should skip ArrayBuffer when checking for Blobs", async () => {
        const proxy = client.getProxy<{
            uploadBuffer(buffer: ArrayBuffer): Promise<any>;
        }>("test");
        
        const largeBuffer = new ArrayBuffer(1 * 1024 * 1024); // 1MB

        const startTime = performance.now();
        await proxy.uploadBuffer(largeBuffer);
        const endTime = performance.now();

        // Should not iterate through buffer
        expect(endTime - startTime).toBeLessThan(500);
    });

    test("should skip Date, RegExp, Map, Set when checking for Blobs", async () => {
        const proxy = client.getProxy<{
            uploadData(data: { date: Date; regex: RegExp; map: Map<string, string>; set: Set<number> }): Promise<any>;
        }>("test");
        
        const data = {
            date: new Date(),
            regex: /test/gi,
            map: new Map([['key1', 'value1'], ['key2', 'value2']]),
            set: new Set([1, 2, 3, 4, 5])
        };

        // These objects should be skipped during Blob detection
        await expect(proxy.uploadData(data)).resolves.toBeDefined();
    });
});
