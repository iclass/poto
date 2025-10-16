import { makeReactiveState } from "./ReactiveState";
import { MSEAudioPlayer } from "./MSEAudioPlayer";
import { StreamingAudioPlayer } from "./StreamingAudioPlayer";
import { getServerModule } from "./serverConnection";

// Store all audio players at module level to persist across renders
let html5Audio: HTMLAudioElement | undefined;
let msePlayer: MSEAudioPlayer | undefined;
let streamingPlayer: StreamingAudioPlayer | undefined;
let audioStateRef: any = undefined; // Reference to the audio state for module-level access

/**
 * Module-level function to reset all audio players
 * Can be called from anywhere in the app (e.g., from main clearResults)
 */
export function resetAllAudioPlayers() {
    // Stop and cleanup HTML5 audio
    if (html5Audio) {
        html5Audio.pause();
        html5Audio.src = '';
        html5Audio = undefined;
    }
    
    // Stop and cleanup Web Audio (MSE)
    if (msePlayer) {
        msePlayer.stop();
        msePlayer.cleanup();
        msePlayer = undefined;
    }
    
    // Stop and cleanup Streaming Audio
    if (streamingPlayer) {
        streamingPlayer.stop();
        streamingPlayer.cleanup();
        streamingPlayer = undefined;
    }
    
    // Clear state if available
    if (audioStateRef) {
        // Clear HTML5 audio state
        if (audioStateRef.html5Audio.url) {
            URL.revokeObjectURL(audioStateRef.html5Audio.url);
            audioStateRef.html5Audio.url = undefined;
        }
        
        // Clear Web Audio state
        audioStateRef.webAudio.isPlaying = false;
        audioStateRef.webAudio.isPaused = false;
        audioStateRef.webAudio.duration = undefined;
        audioStateRef.webAudio.startTime = 0;
        audioStateRef.webAudio.pauseTime = 0;
        
        // Clear Streaming Audio state
        audioStateRef.streamingAudio.isPlaying = false;
        audioStateRef.streamingAudio.isPaused = false;
        audioStateRef.streamingAudio.isStreaming = false;
        audioStateRef.streamingAudio.duration = undefined;
        audioStateRef.streamingAudio.bytesReceived = 0;
    }
    
    console.log('🔄 All audio players reset (module-level)');
}

/**
 * Audio features logic - state management and handlers
 * Separated from UI rendering for better organization
 * 
 * Uses server connection singleton instead of prop drilling
 */
export function useAudioFeatures(isLoggedIn: boolean) {
    
    // ─────────────────────────────────────────────────────────────────────────────
    // AUDIO STATE - Web Audio & Streaming Audio players
    // ─────────────────────────────────────────────────────────────────────────────
    const $audio = makeReactiveState(() => {
        const savedAudioPref = localStorage.getItem('myapp3:autoPlayAudio');
        if (savedAudioPref !== null) console.log('📂 Restored audio preference:', savedAudioPref);

        return {
            autoPlayAudio: savedAudioPref === 'false' ? false : true,
            html5Audio: {
                url: undefined as string | undefined,
            },
            webAudio: {
                isPlaying: false,
                isPaused: false,
                duration: undefined as number | undefined,
                sampleRate: undefined as number | undefined,
                channels: undefined as number | undefined,
                startTime: 0,
                pauseTime: 0,
            },
            streamingAudio: {
                isPlaying: false,
                isPaused: false,
                duration: undefined as number | undefined,
                bytesReceived: 0,
                isStreaming: false,
            },

            // Computed values
            get webAudioState(): 'playing' | 'paused' | 'stopped' {
                if ($audio.webAudio.isPlaying) return 'playing';
                if ($audio.webAudio.isPaused) return 'paused';
                return 'stopped';
            },
            get streamingAudioState(): 'streaming' | 'playing' | 'paused' | 'stopped' {
                if ($audio.streamingAudio.isStreaming) return 'streaming';
                if ($audio.streamingAudio.isPlaying) return 'playing';
                if ($audio.streamingAudio.isPaused) return 'paused';
                return 'stopped';
            },
            get hasWebAudioData(): boolean {
                return $audio.webAudio.duration !== undefined;
            },
            get hasStreamingAudioData(): boolean {
                return $audio.streamingAudio.duration !== undefined;
            },
            get streamingProgressDisplay(): string {
                if (!$audio.streamingAudio.bytesReceived) return '';
                const kb: number = $audio.streamingAudio.bytesReceived / 1024;
                if (kb < 1024) return `${kb.toFixed(2)} KB`;
                return `${(kb / 1024).toFixed(2)} MB`;
            },
        };
    })
    .$withWatch({
        autoPlayAudio: (enabled) => {
            localStorage.setItem('myapp3:autoPlayAudio', String(enabled));
            console.log('💾 [$audio] Preference saved:', enabled ? 'ON' : 'OFF');
        },
    });

    // Store state reference for module-level access
    audioStateRef = $audio;

    // ─────────────────────────────────────────────────────────────────────────────
    // CORE CLEANUP METHODS - Single source of truth for stopping/resetting players
    // ─────────────────────────────────────────────────────────────────────────────
    
    const stopHtml5Audio = () => {
        if (html5Audio) {
            html5Audio.pause();
            html5Audio.src = '';
            html5Audio = undefined;
        }
        
        // Clear the URL from state
        if ($audio.html5Audio.url) {
            URL.revokeObjectURL($audio.html5Audio.url);
            $audio.html5Audio.url = undefined;
        }
    };
    
    const stopWebAudio = () => {
        if (!msePlayer) return;
        
        msePlayer.stop();
        msePlayer.cleanup();
        msePlayer = undefined;
        
        $audio.webAudio.isPlaying = false;
        $audio.webAudio.isPaused = false;
        $audio.webAudio.duration = undefined;
        $audio.webAudio.startTime = 0;
        $audio.webAudio.pauseTime = 0;
    };

    const stopStreamingAudio = () => {
        if (!streamingPlayer) return;
        
        streamingPlayer.stop();
        streamingPlayer.cleanup();
        streamingPlayer = undefined;
        
        $audio.streamingAudio.isPlaying = false;
        $audio.streamingAudio.isPaused = false;
        $audio.streamingAudio.isStreaming = false;
        $audio.streamingAudio.duration = undefined;
        $audio.streamingAudio.bytesReceived = 0;
    };

    const resetAll = () => {
        // Use module-level function for consistency
        resetAllAudioPlayers();
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // HANDLERS - HTML5 Audio
    // ─────────────────────────────────────────────────────────────────────────────
    
    const downloadAudio = async () => {
        const demoModule = getServerModule();
        if (!demoModule) return;

        try {
            // Reset all audio before starting new playback
            resetAll();
            
            // Download audio as a single blob
            const audioBlob: Blob = await demoModule.downloadAudioFile();
            console.log('📦 Audio downloaded:', audioBlob.size, 'bytes');

            // Create object URL for playback
            const url = URL.createObjectURL(audioBlob);
            
            // Store URL in state for UI to display
            $audio.html5Audio.url = url;

            console.log('🎵 HTML5 audio ready to play');
        } catch (error) {
            console.error('❌ Failed to download/play audio:', error);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // HANDLERS - Web Audio API (MSE)
    // ─────────────────────────────────────────────────────────────────────────────

    const playWebAudio = async () => {
        if (!msePlayer) return;

        try {
            // Reset all audio before starting new playback
            resetAll();
            
            await msePlayer.play();
            $audio.webAudio.isPlaying = true;
            $audio.webAudio.isPaused = false;
            $audio.webAudio.startTime = performance.now();
            console.log('▶️  Web Audio playback started');
        } catch (error) {
            console.error('❌ Failed to play audio:', error);
        }
    };

    const pauseWebAudio = () => {
        if (!$audio.webAudio.isPlaying || !msePlayer) return;

        msePlayer.pause();
        $audio.webAudio.isPlaying = false;
        $audio.webAudio.isPaused = true;
        $audio.webAudio.pauseTime = performance.now();
        console.log('⏸️  Web Audio paused');
    };

    const resumeWebAudio = () => {
        if (!$audio.webAudio.isPaused || !msePlayer) return;

        msePlayer.play();
        $audio.webAudio.isPlaying = true;
        $audio.webAudio.isPaused = false;
        const pausedDuration = performance.now() - $audio.webAudio.pauseTime;
        $audio.webAudio.startTime += pausedDuration;
        console.log('▶️  Web Audio resumed');
    };

    const downloadWebAudio = async () => {
        const demoModule = getServerModule();
        if (!demoModule) return;

        try {
            console.log('📥 Downloading audio for Web Audio API...');

            // Reset all audio before starting new playback
            resetAll();

            // Clean up existing player if any
            if (msePlayer) {
                msePlayer.cleanup();
            }

            // Download the complete audio file as a Blob
            const audioBlob: Blob = await demoModule.downloadAudioFile();
            console.log('📦 Audio downloaded:', audioBlob.size, 'bytes');

            // Create new MSE player
            msePlayer = new MSEAudioPlayer();

            // Load and play using MSE player's built-in chunking
            await msePlayer.loadAndPlay(
                audioBlob,
                () => {
                    $audio.webAudio.isPlaying = true;
                    $audio.webAudio.isPaused = false;
                    $audio.webAudio.startTime = performance.now();
                    console.log('▶️  Web Audio playback started');
                },
                (duration) => {
                    $audio.webAudio.duration = duration;
                    console.log('⏱️  Duration:', duration.toFixed(2), 'seconds');
                },
                () => {
                    $audio.webAudio.isPlaying = false;
                    console.log('🏁 Web Audio playback ended');
                }
            );

            console.log('✅ Audio loaded successfully');

            // Note: Auto-play is handled by the loadAndPlay method automatically
            if (!$audio.autoPlayAudio) {
                // If auto-play is disabled, stop the playback that was started
                msePlayer.pause();
                $audio.webAudio.isPlaying = false;
            }
        } catch (error) {
            console.error('❌ Failed to download audio:', error);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // HANDLERS - Streaming Audio
    // ─────────────────────────────────────────────────────────────────────────────

    const streamAudio = async () => {
        const demoModule = getServerModule();
        if (!demoModule) return;

        try {
            console.log('🌊 Starting progressive streaming audio...');

            // Reset all audio before starting new playback
            resetAll();

            // Clean up existing player if any
            if (streamingPlayer) {
                streamingPlayer.cleanup();
            }

            // Create new streaming player
            streamingPlayer = new StreamingAudioPlayer();

            $audio.streamingAudio.isStreaming = true;
            $audio.streamingAudio.bytesReceived = 0;

            // Get ReadableStream from server
            const stream: ReadableStream<Uint8Array> = await demoModule.streamAudioFile();

            // Use streamAndPlay which handles chunking internally
            await streamingPlayer.streamAndPlay(
                stream,
                () => {
                    $audio.streamingAudio.isPlaying = true;
                    $audio.streamingAudio.isPaused = false;
                    console.log('▶️  Streaming audio playback started');
                },
                (duration) => {
                    $audio.streamingAudio.duration = duration;
                    console.log('⏱️  Duration:', duration.toFixed(2), 'seconds');
                },
                () => {
                    $audio.streamingAudio.isPlaying = false;
                    console.log('🏁 Streaming audio playback ended');
                },
                (bytesReceived) => {
                    $audio.streamingAudio.bytesReceived = bytesReceived;
                    console.log('🌊 Progress:', bytesReceived, 'bytes');
                }
            );

            $audio.streamingAudio.isStreaming = false;
            console.log('✅ Streaming complete');

            // Note: Auto-play is handled by the streamAndPlay method automatically
            if (!$audio.autoPlayAudio) {
                // If auto-play is disabled, stop the playback that was started
                streamingPlayer.pause();
                $audio.streamingAudio.isPlaying = false;
            }
        } catch (error) {
            console.error('❌ Failed to stream audio:', error);
            $audio.streamingAudio.isStreaming = false;
        }
    };

    const playStreamingAudio = () => {
        if (!streamingPlayer) return;

        // Reset all audio before starting new playback
        resetAll();
        
        streamingPlayer.play();
        $audio.streamingAudio.isPlaying = true;
        $audio.streamingAudio.isPaused = false;
        console.log('▶️  Streaming audio playing');
    };

    const pauseStreamingAudio = () => {
        if (!$audio.streamingAudio.isPlaying || !streamingPlayer) return;

        streamingPlayer.pause();
        $audio.streamingAudio.isPlaying = false;
        $audio.streamingAudio.isPaused = true;
        console.log('⏸️  Streaming audio paused');
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // RETURN ALL STATE AND HANDLERS
    // ─────────────────────────────────────────────────────────────────────────────

    return {
        // State
        $audio,
        isLoggedIn,

        // HTML5 handlers
        downloadAudio,

        // Web Audio handlers
        downloadWebAudio,
        playWebAudio,
        pauseWebAudio,
        resumeWebAudio,
        stopWebAudio,

        // Streaming Audio handlers
        streamAudio,
        playStreamingAudio,
        pauseStreamingAudio,
        stopStreamingAudio,
    };
}

