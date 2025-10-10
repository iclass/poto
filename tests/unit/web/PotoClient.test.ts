import { describe, test, expect, beforeEach } from "bun:test";
import { PotoClient } from "../../../src/web/rpc/PotoClient";

describe("PotoClient Method Override Tests - GET/DELETE with Arguments", () => {
    let client: PotoClient;
    let mockStorage: any;
    let capturedRequests: Array<{ method: string; url: string; body?: any }> = [];

    beforeEach(() => {
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
