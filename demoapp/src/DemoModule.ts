import { PotoModule, roles } from 'poto';
import { Constants } from './demoConsts';
import { GenData, ServerInfo, ImageSize } from './demoConsts';
import * as fs from 'fs';
import * as path from 'path';

// Simple demo module with basic functionality
export class DemoModule extends PotoModule {
    getRoute(): string {
        return Constants.serverModuleName;
    }


    // Simple greeting method
    async hello_(message: string): Promise<string> {
        // Option 1: Use cleaner setSession helper method
        // console.log('setting session data: ' + message);
        await this.setSessionValue(Constants.sessionKey, message);

        const user = this.getCurrentUser();
        return `Hello ${user?.id || 'anonymous'}! Welcome back. message stored in session: ${message}`;
    }

    // Simple message method
    async postMessage_(message: string): Promise<string> {
        const user = this.getCurrentUser();
        return `Echo: ${message} (from ${user?.id || 'anonymous'}), with session data: ${(await this.getSessionValue(Constants.sessionKey))}`;
    }


    // Async generator method for streaming data
    async *testStream(count: number): AsyncGenerator<GenData> {
        const user = this.getCurrentUser();
        const userId = user?.id;

        for (let i = 1; i <= count; i++) {
            yield {
                step: i,
                total: count,
                message: `Processing step ${i} of ${count}`,
                timestamp: new Date().toISOString(),
                user: userId || 'not logged in'
            };

            // Simulate some work
            await new Promise(resolve => setTimeout(resolve, 20));
        }

        yield {
            step: count + 1,
            total: count,
            message: 'Stream completed successfully!',
            timestamp: new Date().toISOString(),
            user: userId || 'not logged in'
        };
    }

    // Method to get server info
    async getServerInfo(): Promise<ServerInfo> {
        const user = this.getCurrentUser();
        return {
            serverName: 'Poto Demo Server',
            version: '1.0.2',
            user: user?.id || 'anonymous',
            timestamp: new Date().toISOString(),
            features: ['RPC', 'Streaming', 'Authentication', 'Session Management']
        };
    }

    // Admin-only method that requires admin role
    @roles(Constants.roles.admin)
    async getAdminSecret(): Promise<{ secret: string, adminUser: string, timestamp: string, clearance: string, message: string }> {
        const user = this.getCurrentUser();
        return {
            secret: 'This is a top-secret admin-only message!',
            adminUser: 'you are:' + (user?.id ?? '??'),
            timestamp: new Date().toLocaleString(),
            clearance: 'TOP SECRET',
            message: 'Only users with admin role can access this data.'
        };
    }

    async getImageSize(imageData: Uint8Array): Promise<ImageSize> {
        return this.calculateImageSize(imageData);
    }

    async getImageSizeArrayBuffer(imageData: ArrayBuffer): Promise<ImageSize> {
        const uint8Array = new Uint8Array(imageData);
        return this.calculateImageSize(uint8Array);
    }

    async getImageSizeFile(imageFile: File): Promise<ImageSize> {
        const arrayBuffer = await imageFile.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        return this.calculateImageSize(uint8Array);
    }


    calculateImageSize(imageData: Uint8Array<ArrayBufferLike>): ImageSize {
        // Validate PNG signature
        const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        for (let i = 0; i < pngSignature.length; i++) {
            if (imageData[i] !== pngSignature[i]) {
                throw new Error('Invalid PNG file signature');
            }
        }

        // Find IHDR chunk
        let offset = 8; // Skip PNG signature
        while (offset < imageData.length - 8) {
            // Read chunk length (4 bytes, big-endian)
            const chunkLength = (imageData[offset] << 24) |
                (imageData[offset + 1] << 16) |
                (imageData[offset + 2] << 8) |
                imageData[offset + 3];

            // Read chunk type (4 bytes)
            const chunkType = String.fromCharCode(
                imageData[offset + 4],
                imageData[offset + 5],
                imageData[offset + 6],
                imageData[offset + 7]
            );

            if (chunkType === 'IHDR') {
                // IHDR chunk found, read width and height
                const width = (imageData[offset + 8] << 24) |
                    (imageData[offset + 9] << 16) |
                    (imageData[offset + 10] << 8) |
                    imageData[offset + 11];

                const height = (imageData[offset + 12] << 24) |
                    (imageData[offset + 13] << 16) |
                    (imageData[offset + 14] << 8) |
                    imageData[offset + 15];

                return {
                    width,
                    height
                };
            }

            // Move to next chunk (length + type + data + CRC = 12 + chunkLength)
            offset += 12 + chunkLength;
        }

        throw new Error('IHDR chunk not found in PNG file');
    }

    async downloadImageAsFile(): Promise<Blob> {
        return Bun.file(path.join(process.cwd(), 'public', 'logo.jpg'));
    }
    /**
     * this is as fast as it can be since http supports Blob responses natively
     * @returns Blob of the audio file
     */
    async downloadAudioFile(): Promise<Blob> {
        // // This method demonstrates loading file with BunFile -> ArrayBuffer -> Blob conversion (flip flop)
        // const bunFile = Bun.file(path.join(process.cwd(), 'public', 'Caliente.mp3'));
        // const arrayBuffer = await bunFile.arrayBuffer();
        // // Create Blob from ArrayBuffer (type is best guess for mp3)
        // const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
        // return blob;
        console.log('downloadAudioFile, using BunFile');
        return Bun.file(path.join(process.cwd(), 'public', 'Caliente.mp3'));
    }


    async downloadImageAsArrayBuffer(): Promise<ArrayBuffer> {
        const imageFile = Bun.file(path.join(process.cwd(), 'public', 'logo.jpg'));
        return imageFile.arrayBuffer();
    }


    /**
     * Stream audio file as a pure ReadableStream - demonstrates true network streaming
     * where chunks are sent progressively over the wire
    // Bun.file().stream() returns a native ReadableStream - simple and efficient!
     */
    async streamAudioFile(): Promise<ReadableStream<Uint8Array>> {   
        console.log('streamAudioFile, using BunFile.stream');
        return (Bun.file(path.join(process.cwd(), 'public', 'Caliente.mp3'))).stream();
    }
}
