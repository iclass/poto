import { PotoModule } from "../../src/server/PotoModule";
import { stringifyTypedJson, parseTypedJson } from "../../src/shared/TypedJsonUtils";

/**
 * Test module for comprehensive JavaScript data type round-trip testing
 * This module provides methods to test serialization/deserialization of various data types
 */
export class PotoDataTypesTestModule extends PotoModule {

    /**
     * Test primitive data types
     */
    async postTestPrimitives_(data: {
        string: string;
        number: number;
        boolean: boolean;
        nullValue: null;
        undefinedValue: undefined;
    }): Promise<typeof data> {
        return data;
    }

    /**
     * Test special number values
     */
    async postTestSpecialNumbers_(data: {
        infinity: number;
        negativeInfinity: number;
        notANumber: number;
        negativeZero: number;
        largeNumber: number;
    }): Promise<typeof data> {
        return data;
    }

    /**
     * Test Date objects
     */
    async postTestDates_(data: {
        date: Date;
        dateString: string;
        timestamp: number;
        invalidDate: Date;
    }): Promise<typeof data> {
        return data;
    }

    /**
     * Test RegExp objects
     */
    async postTestRegExp_(data: {
        regex: RegExp;
        globalRegex: RegExp;
        caseInsensitiveRegex: RegExp;
        multilineRegex: RegExp;
    }): Promise<typeof data> {
        return data;
    }

    /**
     * Test Map and Set objects
     */
    async postTestMapSet_(data: {
        map: Map<string, any>;
        set: Set<any>;
        nestedMap: Map<string, Map<string, number>>;
        nestedSet: Set<Set<string>>;
    }): Promise<typeof data> {
        return data;
    }

    /**
     * Test Error objects
     */
    async postTestErrors_(data: {
        error: Error;
        customError: Error;
        errorWithStack: Error;
    }): Promise<typeof data> {
        return data;
    }

    /**
     * Test URL objects
     */
    async postTestUrls_(data: {
        url: URL;
        urlWithParams: URL;
        relativeUrl: URL;
    }): Promise<typeof data> {
        return data;
    }

    /**
     * Test ArrayBuffer and TypedArray
     */
    async postTestArrayBuffer_(data: {
        buffer: ArrayBuffer;
        uint8Array: Uint8Array;
        int32Array: Int32Array;
        float64Array: Float64Array;
    }): Promise<typeof data> {
        return data;
    }

    /**
     * Test Blob objects (async due to Blob serialization requirements)
     */
    async postTestBlobs_(data: {
        textBlob: Blob;
        jsonBlob: Blob;
        binaryBlob: Blob;
        emptyBlob: Blob;
    }): Promise<typeof data> {
        return data;
    }

    /**
     * Test complex nested objects
     */
    async postTestComplexObjects_(data: {
        user: {
            id: number;
            name: string;
            profile: {
                avatar: string;
                settings: {
                    theme: string;
                    notifications: boolean;
                };
                createdAt: Date;
            };
            tags: string[];
            metadata: Map<string, any>;
        };
        config: {
            version: string;
            features: Set<string>;
            limits: {
                maxUsers: number;
                timeout: number;
            };
        };
    }): Promise<typeof data> {
        return data;
    }

    /**
     * Test arrays with mixed content
     */
    async postTestMixedArrays_(data: {
        mixedArray: (string | number | boolean | Date | RegExp | null)[];
        nestedArrays: (string[] | number[])[];
        arrayWithObjects: Array<{
            id: number;
            data: any;
            timestamp: Date;
        }>;
    }): Promise<typeof data> {
        return data;
    }

    /**
     * Test circular references (should be handled gracefully)
     */
    async postTestCircularReferences_(data: any): Promise<any> {
        return data;
    }

    /**
     * Test large data structures
     */
    async postTestLargeData_(data: {
        largeArray: number[];
        largeObject: Record<string, any>;
        largeString: string;
    }): Promise<typeof data> {
        return data;
    }

    /**
     * Test edge cases and boundary conditions
     */
    async postTestEdgeCases_(data: {
        emptyString: string;
        whitespaceString: string;
        unicodeString: string;
        emptyArray: any[];
        emptyObject: Record<string, any>;
        zeroLengthBuffer: ArrayBuffer;
    }): Promise<typeof data> {
        return data;
    }

    /**
     * Test function serialization (should be handled gracefully)
     */
    async postTestFunctions_(data: {
        simpleFunction: Function;
        arrowFunction: Function;
        asyncFunction: Function;
    }): Promise<any> {
        // Functions should be serialized as null or handled gracefully
        return {
            simpleFunction: data.simpleFunction ? null : null,
            arrowFunction: data.arrowFunction ? null : null,
            asyncFunction: data.asyncFunction ? null : null,
        };
    }

    /**
     * Test Symbol serialization (should be handled gracefully)
     */
    async postTestSymbols_(data: {
        symbol: Symbol;
        symbolWithDescription: Symbol;
    }): Promise<any> {
        // Symbols should be serialized as null or handled gracefully
        return {
            symbol: null,
            symbolWithDescription: null,
        };
    }

    /**
     * Test BigInt serialization
     */
    async postTestBigInt_(data: {
        bigInt: bigint;
        largeBigInt: bigint;
        negativeBigInt: bigint;
    }): Promise<typeof data> {
        return data;
    }

    /**
     * Test property order preservation
     */
    async postTestPropertyOrder_(data: {
        z: string;
        a: string;
        m: string;
        b: string;
        y: string;
    }): Promise<typeof data> {
        return data;
    }

    /**
     * Test round-trip with multiple serialization cycles
     */
    async postTestMultipleRounds_(data: any, rounds: number = 3): Promise<any> {
        let current = data;
        for (let i = 0; i < rounds; i++) {
            // This simulates multiple serialization/deserialization cycles using TypedJSON
            const serialized = stringifyTypedJson(current);
            current = parseTypedJson(serialized);
        }
        return current;
    }

    /**
     * Test performance with large datasets
     */
    async postTestPerformance_(size: number): Promise<{
        arraySize: number;
        objectSize: number;
        stringSize: number;
        processingTime: number;
    }> {
        const startTime = Date.now();
        
        // Create large array
        const largeArray = Array.from({ length: size }, (_, i) => i);
        
        // Create large object
        const largeObject = Object.fromEntries(
            Array.from({ length: size }, (_, i) => [`key${i}`, `value${i}`])
        );
        
        // Create large string
        const largeString = 'x'.repeat(size);
        
        const processingTime = Date.now() - startTime;
        
        return {
            arraySize: largeArray.length,
            objectSize: Object.keys(largeObject).length,
            stringSize: largeString.length,
            processingTime
        };
    }

    /**
     * Test memory safety features
     */
    async postTestMemorySafety_(data: {
        normalData: any;
        deepNesting: any;
        largeBuffer: ArrayBuffer;
    }): Promise<{
        normalDataProcessed: boolean;
        deepNestingProcessed: boolean;
        largeBufferProcessed: boolean;
    }> {
        return {
            normalDataProcessed: true,
            deepNestingProcessed: true,
            largeBufferProcessed: true,
        };
    }
}
