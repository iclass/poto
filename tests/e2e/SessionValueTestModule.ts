import { PotoModule } from "../../src/server/PotoModule";

/**
 * Test module for testing session value storage and retrieval
 */
export class SessionValueTestModule extends PotoModule {

    /**
     * Set a test value in the session
     */
    async setASessionValue_(key: string, value: any): Promise<{ success: boolean; message: string; userId: string | undefined }> {
        const user = await this.getCurrentUser();
        try {
            await this.setSessionValue(key, value);
            return {
                success: true,
                message: `Session value '${key}' set successfully`,
                userId: user?.id
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to set session value: ${error}`,
                userId: user?.id
            };
        }
    }

    /**
     * Get a test value from the session
     */
    async getASessionValue_(key: string): Promise<{ success: boolean; value: any; message: string; userId: string | undefined }> {
        const user = await this.getCurrentUser();
        try {
            const value = await this.getSessionValue(key);
            return {
                success: true,
                value,
                message: `Session value '${key}' retrieved successfully`,
                userId: user?.id
            };
        } catch (error) {
            return {
                success: false,
                value: undefined,
                message: `Failed to get session value: ${error}`,
                userId: user?.id
            };
        }
    }

    /**
     * Set multiple session values at once
     */
    async postSetMultipleSessionValues_(values: Record<string, any>): Promise<{ success: boolean; message: string; userId: string | undefined }> {
        const user = await this.getCurrentUser();
        try {
            for (const [key, value] of Object.entries(values)) {
                await this.setSessionValue(key, value);
            }
            return {
                success: true,
                message: `Set ${Object.keys(values).length} session values successfully`,
                userId: user?.id
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to set multiple session values: ${error}`,
                userId: user?.id
            };
        }
    }

    /**
     * Get all session values (returns a subset for testing)
     */
    async postGetAllSessionValues_(keys: string[]): Promise<{ success: boolean; values: Record<string, any>; message: string; userId: string | undefined }> {
        const user = await this.getCurrentUser();
        try {
            const values: Record<string, any> = {};
            for (const key of keys) {
                values[key] = await this.getSessionValue(key);
            }
            return {
                success: true,
                values,
                message: `Retrieved ${keys.length} session values successfully`,
                userId: user?.id
            };
        } catch (error) {
            return {
                success: false,
                values: {},
                message: `Failed to get session values: ${error}`,
                userId: user?.id
            };
        }
    }

    /**
     * Test session value persistence across multiple requests
     */
    async postTestSessionPersistence_(testData: { key: string; value: any; iterations: number }): Promise<{ success: boolean; results: any[]; message: string; userId: string | undefined }> {
        const user = await this.getCurrentUser();
        try {
            const results: any[] = [];
            
            // Set the initial value
            await this.setSessionValue(testData.key, testData.value);
            results.push({ action: 'set', key: testData.key, value: testData.value });
            
            // Retrieve it multiple times to test persistence
            for (let i = 0; i < testData.iterations; i++) {
                const retrievedValue = await this.getSessionValue(testData.key);
                results.push({ action: 'get', iteration: i + 1, key: testData.key, value: retrievedValue });
            }
            
            return {
                success: true,
                results,
                message: `Session persistence test completed with ${testData.iterations} iterations`,
                userId: user?.id
            };
        } catch (error) {
            return {
                success: false,
                results: [],
                message: `Session persistence test failed: ${error}`,
                userId: user?.id
            };
        }
    }

    /**
     * Test complex data types in session values
     */
    async postTestComplexSessionData_(): Promise<{ success: boolean; results: any; message: string; userId: string | undefined }> {
        const user = await this.getCurrentUser();
        try {
            const complexData = {
                string: "Hello, World!",
                number: 42,
                boolean: true,
                array: [1, 2, 3, "test"],
                object: {
                    nested: true,
                    value: "nested value",
                    numbers: [10, 20, 30]
                },
                nullValue: null,
                undefinedValue: undefined
            };

            // Store complex data
            await this.setSessionValue("complexData", complexData);
            
            // Retrieve and verify
            const retrievedData = await this.getSessionValue("complexData");
            
            return {
                success: true,
                results: {
                    original: complexData,
                    retrieved: retrievedData,
                    match: JSON.stringify(complexData) === JSON.stringify(retrievedData)
                },
                message: "Complex session data test completed",
                userId: user?.id
            };
        } catch (error) {
            return {
                success: false,
                results: null,
                message: `Complex session data test failed: ${error}`,
                userId: user?.id
            };
        }
    }

    /**
     * Test session value updates
     */
    async postTestSessionValueUpdates_(key: string, values: any[]): Promise<{ success: boolean; results: any[]; message: string; userId: string | undefined }> {
        const user = await this.getCurrentUser();
        try {
            const results: any[] = [];
            
            // Set and update the value multiple times
            for (let i = 0; i < values.length; i++) {
                await this.setSessionValue(key, values[i]);
                const retrieved = await this.getSessionValue(key);
                results.push({
                    iteration: i + 1,
                    setValue: values[i],
                    retrievedValue: retrieved,
                    match: JSON.stringify(values[i]) === JSON.stringify(retrieved)
                });
            }
            
            return {
                success: true,
                results,
                message: `Session value update test completed with ${values.length} updates`,
                userId: user?.id
            };
        } catch (error) {
            return {
                success: false,
                results: [],
                message: `Session value update test failed: ${error}`,
                userId: user?.id
            };
        }
    }
}
