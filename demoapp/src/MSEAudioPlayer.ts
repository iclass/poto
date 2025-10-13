/**
 * MSEAudioPlayer - Media Source Extensions audio player for low-latency streaming
 * 
 * Provides fast audio playback by streaming in chunks instead of decoding entire file.
 * Starts playback almost immediately after first chunk loads.
 */
export class MSEAudioPlayer {
    private mediaSource: MediaSource | null = null;
    private audioElement: HTMLAudioElement | null = null;
    private sourceBuffer: SourceBuffer | null = null;
    
    /**
     * Load and play audio from a Blob using MSE streaming
     * @param audioBlob - The audio file as a Blob
     * @param onPlaybackStart - Callback when playback starts
     * @param onMetadataLoaded - Callback when audio metadata is available
     * @param onEnded - Callback when playback ends
     * @param chunkSize - Size of each chunk in bytes (default: 256KB)
     */
    async loadAndPlay(
        audioBlob: Blob,
        onPlaybackStart?: () => void,
        onMetadataLoaded?: (duration: number) => void,
        onEnded?: () => void,
        chunkSize: number = 256 * 1024
    ): Promise<void> {
        // Clean up any existing playback first
        this.cleanup();
        
        return new Promise((resolve, reject) => {
            this.mediaSource = new MediaSource();
            this.audioElement = new Audio();
            this.audioElement.src = URL.createObjectURL(this.mediaSource);
            
            this.mediaSource.addEventListener('sourceopen', async () => {
                try {
                    if (!this.mediaSource) {
                        reject(new Error('MediaSource was cleaned up'));
                        return;
                    }
                    
                    this.sourceBuffer = this.mediaSource.addSourceBuffer('audio/mpeg');
                    const arrayBuffer = await audioBlob.arrayBuffer();
                    
                    let offset = 0;
                    let isFirstChunk = true;
                    
                    const appendNextChunk = () => {
                        if (!this.sourceBuffer || !this.mediaSource || !this.audioElement) {
                            return;
                        }
                        
                        if (offset >= arrayBuffer.byteLength) {
                            if (this.mediaSource.readyState === 'open') {
                                this.mediaSource.endOfStream();
                            }
                            resolve();
                            return;
                        }
                        
                        const chunk = arrayBuffer.slice(offset, offset + chunkSize);
                        offset += chunkSize;
                        
                        this.sourceBuffer.appendBuffer(chunk);
                        
                        // Start playback as soon as first chunk is loaded!
                        if (isFirstChunk && this.audioElement) {
                            isFirstChunk = false;
                            this.audioElement.play().catch(reject);
                            onPlaybackStart?.();
                        }
                    };
                    
                    this.sourceBuffer.addEventListener('updateend', () => {
                        if (this.sourceBuffer && !this.sourceBuffer.updating && offset < arrayBuffer.byteLength) {
                            appendNextChunk();
                        }
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
                    
                    // Start the streaming process
                    appendNextChunk();
                } catch (error) {
                    reject(error);
                }
            });
        });
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

