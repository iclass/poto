/**
 * StreamingAudioPlayer - Progressive audio streaming player
 * 
 * Consumes a ReadableStream (or async iterable) of audio chunks and plays them
 * progressively as they arrive from the server. This demonstrates true network
 * streaming where playback can start before the entire file is downloaded.
 * 
 * Two main usage patterns:
 * 1. streamAndPlay() - All-in-one method with full control and callbacks
 * 2. createStreamURL() - Get a URL for use with any <audio> element (simpler API)
 */
export class StreamingAudioPlayer {
    private mediaSource: MediaSource | null = null;
    private audioElement: HTMLAudioElement | null = null;
    private sourceBuffer: SourceBuffer | null = null;
    private isStreamingActive = false;
    private pendingChunks: Uint8Array<ArrayBuffer>[] = [];
    
    /**
     * Stream and play audio from a ReadableStream or async iterable of Uint8Array chunks
     * @param audioStream - ReadableStream or async iterable that yields audio data chunks
     * @param onPlaybackStart - Callback when playback starts
     * @param onMetadataLoaded - Callback when audio metadata is available
     * @param onEnded - Callback when playback ends
     * @param onProgress - Callback for progress updates (bytes received)
     */
    async streamAndPlay(
        audioStream: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>,
        onPlaybackStart?: () => void,
        onMetadataLoaded?: (duration: number) => void,
        onEnded?: () => void,
        onProgress?: (bytesReceived: number) => void
    ): Promise<void> {
        // Clean up any existing playback first
        this.cleanup();
        
        return new Promise(async (resolve, reject) => {
            try {
                this.mediaSource = new MediaSource();
                this.audioElement = new Audio();
                this.audioElement.src = URL.createObjectURL(this.mediaSource);
                this.isStreamingActive = true;
                
                let totalBytesReceived = 0;
                let isFirstChunk = true;
                
                this.mediaSource.addEventListener('sourceopen', async () => {
                    try {
                        if (!this.mediaSource) {
                            reject(new Error('MediaSource was cleaned up'));
                            return;
                        }
                        
                        this.sourceBuffer = this.mediaSource.addSourceBuffer('audio/mpeg');
                        
                        // Set up the buffer update handler
                        this.sourceBuffer.addEventListener('updateend', () => {
                            this.appendNextPendingChunk();
                        });
                        
                        // Update duration when metadata is loaded
                        if (this.audioElement) {
                            this.audioElement.addEventListener('loadedmetadata', () => {
                                if (this.audioElement) {
                                    onMetadataLoaded?.(this.audioElement.duration);
                                }
                            });
                            
                            // Handle end of playback
                            this.audioElement.addEventListener('ended', () => {
                                onEnded?.();
                            });
                        }
                        
                        // Convert ReadableStream to async iterable if needed
                        const iterable = 'getReader' in audioStream 
                            ? this.readableStreamToAsyncIterable(audioStream as ReadableStream<Uint8Array>)
                            : audioStream as AsyncIterable<Uint8Array>;
                        
                        // Consume the stream
                        for await (const chunk of iterable) {
                            if (!this.isStreamingActive) {
                                break;
                            }
                            
                            totalBytesReceived += chunk.byteLength;
                            onProgress?.(totalBytesReceived);
                            
                            // Add chunk to queue
                            this.pendingChunks.push(chunk as Uint8Array<ArrayBuffer>);
                            
                            // Start appending if not already in progress
                            if (!this.sourceBuffer?.updating) {
                                this.appendNextPendingChunk();
                            }
                            
                            // Start playback after first chunk
                            if (isFirstChunk && this.audioElement) {
                                isFirstChunk = false;
                                await this.audioElement.play();
                                onPlaybackStart?.();
                            }
                        }
                        
                        // Wait for all pending chunks to be appended
                        while (this.pendingChunks.length > 0 || this.sourceBuffer?.updating) {
                            await new Promise(resolve => setTimeout(resolve, 50));
                        }
                        
                        // Signal end of stream
                        if (this.mediaSource && this.mediaSource.readyState === 'open') {
                            this.mediaSource.endOfStream();
                        }
                        
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * Create a streaming URL from a ReadableStream that can be used with any audio element.
     * This gives you a URL (via MediaSource + URL.createObjectURL) that manually assembles
     * the stream chunk-by-chunk in real-time as data arrives from your RPC call.
     * 
     * @param audioStream - ReadableStream or async iterable that yields audio data chunks
     * @param onProgress - Optional callback for progress updates (bytes received)
     * @param onError - Optional callback for errors during streaming
     * @returns A blob URL that can be set as audio.src
     * 
     * @example
     * // Basic usage - hook up your RPC stream to any audio player
     * const stream = await demoModule.streamAudioFile();  // Your RPC call returns ReadableStream
     * const player = new StreamingAudioPlayer();
     * const streamUrl = player.createStreamURL(stream);
     * 
     * // Use with standard HTML5 audio element
     * const audio = new Audio();
     * audio.src = streamUrl;  // The magic one-liner! Your RPC stream → playable URL
     * audio.play();
     * 
     * @example
     * // With progress tracking
     * const streamUrl = player.createStreamURL(stream, 
     *     (bytes) => console.log(`Received: ${bytes} bytes`),
     *     (error) => console.error('Stream error:', error)
     * );
     * 
     * @example
     * // With React state
     * const [audioUrl, setAudioUrl] = useState<string>('');
     * 
     * const loadStream = async () => {
     *     const stream = await $.demoModule.streamAudioFile();
     *     const url = player.createStreamURL(stream);
     *     setAudioUrl(url);  // Now use it anywhere: <audio src={audioUrl} />
     * };
     * 
     * @note The stream is processed in the background. The URL is available immediately
     *       and playback will start as soon as enough data has been buffered.
     * @note Remember to call cleanup() when done to release resources.
     */
    createStreamURL(
        audioStream: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>,
        onProgress?: (bytesReceived: number) => void,
        onError?: (error: Error) => void
    ): string {
        // Clean up any existing playback first
        this.cleanup();
        
        this.mediaSource = new MediaSource();
        const url = URL.createObjectURL(this.mediaSource);
        this.isStreamingActive = true;
        
        let totalBytesReceived = 0;
        
        // Process the stream in the background
        this.mediaSource.addEventListener('sourceopen', async () => {
            try {
                if (!this.mediaSource) {
                    throw new Error('MediaSource was cleaned up');
                }
                
                this.sourceBuffer = this.mediaSource.addSourceBuffer('audio/mpeg');
                
                // Set up the buffer update handler for chunk queuing
                this.sourceBuffer.addEventListener('updateend', () => {
                    this.appendNextPendingChunk();
                });
                
                // Convert ReadableStream to async iterable if needed
                const iterable = 'getReader' in audioStream 
                    ? this.readableStreamToAsyncIterable(audioStream as ReadableStream<Uint8Array>)
                    : audioStream as AsyncIterable<Uint8Array>;
                
                // Consume and manually assemble the stream chunk by chunk
                for await (const chunk of iterable) {
                    if (!this.isStreamingActive) {
                        break;
                    }
                    
                    totalBytesReceived += chunk.byteLength;
                    onProgress?.(totalBytesReceived);
                    
                    // Add chunk to queue for manual assembly
                    this.pendingChunks.push(chunk as Uint8Array<ArrayBuffer>);
                    
                    // Start appending if not already in progress
                    if (!this.sourceBuffer?.updating) {
                        this.appendNextPendingChunk();
                    }
                }
                
                // Wait for all pending chunks to be appended
                while (this.pendingChunks.length > 0 || this.sourceBuffer?.updating) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                
                // Signal end of stream
                if (this.mediaSource && this.mediaSource.readyState === 'open') {
                    this.mediaSource.endOfStream();
                }
            } catch (error) {
                console.error('Error streaming audio:', error);
                onError?.(error instanceof Error ? error : new Error(String(error)));
            }
        });
        
        return url;
    }
    
    /**
     * Convert a ReadableStream to an async iterable
     */
    private async *readableStreamToAsyncIterable(stream: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
        const reader = stream.getReader();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                yield value;
            }
        } finally {
            reader.releaseLock();
        }
    }
    
    /**
     * Append the next pending chunk to the source buffer
     */
    private appendNextPendingChunk(): void {
        if (!this.sourceBuffer || this.sourceBuffer.updating || this.pendingChunks.length === 0) {
            return;
        }
        
        const chunk = this.pendingChunks.shift();
        if (chunk) {
            try {
                this.sourceBuffer.appendBuffer(chunk);
            } catch (error) {
                console.error('Failed to append buffer:', error);
            }
        }
    }
    
    /**
     * Play or resume playback
     */
    play(): void {
        if (this.audioElement) {
            this.audioElement.play();
        }
    }
    
    /**
     * Pause playback
     */
    pause(): void {
        if (this.audioElement) {
            this.audioElement.pause();
        }
    }
    
    /**
     * Stop playback and reset to beginning
     */
    stop(): void {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
        }
    }
    
    /**
     * Restart playback from beginning
     */
    restart(): void {
        if (this.audioElement) {
            this.audioElement.currentTime = 0;
            this.audioElement.play();
        }
    }
    
    /**
     * Get current playback state
     */
    isPlaying(): boolean {
        return this.audioElement ? !this.audioElement.paused : false;
    }
    
    /**
     * Get audio duration
     */
    getDuration(): number {
        return this.audioElement?.duration || 0;
    }
    
    /**
     * Get current playback position
     */
    getCurrentTime(): number {
        return this.audioElement?.currentTime || 0;
    }
    
    /**
     * Set playback position
     */
    setCurrentTime(time: number): void {
        if (this.audioElement) {
            this.audioElement.currentTime = time;
        }
    }
    
    /**
     * Clean up resources
     */
    cleanup(): void {
        this.isStreamingActive = false;
        this.pendingChunks = [];
        
        // Clean up audio element
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.src = '';
            this.audioElement.load();
            this.audioElement = null;
        }
        
        // Clean up MediaSource
        if (this.mediaSource && this.mediaSource.readyState === 'open') {
            try {
                this.mediaSource.endOfStream();
            } catch (e) {
                // Already ended
            }
        }
        this.mediaSource = null;
        this.sourceBuffer = null;
    }
    
    /**
     * Get the underlying audio element (for advanced use)
     */
    getAudioElement(): HTMLAudioElement | null {
        return this.audioElement;
    }
}

