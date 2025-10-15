import type { DemoModule } from "./DemoModule";
import { makeState } from "./ReactiveState";
import { MSEAudioPlayer } from "./MSEAudioPlayer";
import { StreamingAudioPlayer } from "./StreamingAudioPlayer";

// Store MSE player at module level to persist across renders
let msePlayer: MSEAudioPlayer | undefined;
// Store streaming player at module level
let streamingPlayer: StreamingAudioPlayer | undefined;

interface MyApp3AudioProps {
    demoModule: DemoModule;
    isLoggedIn: boolean;
}

export function MyApp3Audio({ demoModule, isLoggedIn }: MyApp3AudioProps) {
    
    // ─────────────────────────────────────────────────────────────────────────────
    // AUDIO STATE - Web Audio & Streaming Audio players
    // ─────────────────────────────────────────────────────────────────────────────
    const $audio = makeState(() => {
        const savedAudioPref = localStorage.getItem('myapp3:autoPlayAudio');
        if (savedAudioPref !== null) console.log('📂 Restored audio preference:', savedAudioPref);

        return {
            autoPlayAudio: savedAudioPref === 'false' ? false : true,
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

    const downloadAudio = async () => {
        if (!demoModule) return;

        try {
            // Download audio as a single blob
            const audioBlob: Blob = await demoModule.downloadAudio();
            console.log('📦 Audio downloaded:', audioBlob.size, 'bytes');

            // Create object URL for playback
            const url = URL.createObjectURL(audioBlob);

            // Play in HTML5 audio element
            const audio = new Audio(url);
            audio.play();

            // Auto-play if enabled
            if ($audio.autoPlayAudio) {
                await audio.play();
            }

            console.log('🎵 Playing audio via HTML5 <audio> element');
        } catch (error) {
            console.error('❌ Failed to download/play audio:', error);
        }
    };

    const playWebAudio = async () => {
        if (!msePlayer) return;

        try {
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

        msePlayer.resume();
        $audio.webAudio.isPlaying = true;
        $audio.webAudio.isPaused = false;
        const pausedDuration = performance.now() - $audio.webAudio.pauseTime;
        $audio.webAudio.startTime += pausedDuration;
        console.log('▶️  Web Audio resumed');
    };

    const stopWebAudio = () => {
        if (!msePlayer) return;

        msePlayer.stop();
        $audio.webAudio.isPlaying = false;
        $audio.webAudio.isPaused = false;
        console.log('⏹️  Web Audio stopped');
    };

    const downloadWebAudio = async () => {
        if (!demoModule) return;

        try {
            console.log('📥 Downloading audio for Web Audio API...');

            // Create MSE player if needed
            if (!msePlayer) {
                msePlayer = new MSEAudioPlayer();
            }

            // Get ReadableStream from server
            const stream: ReadableStream<Uint8Array> = await demoModule.streamAudio();
            const reader = stream.getReader();

            // Feed chunks to MSE player
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                await msePlayer.appendChunk(value);
                console.log('🎵 Appended audio chunk:', value.byteLength, 'bytes');
            }

            // Finalize the stream
            msePlayer.endOfStream();
            console.log('✅ Audio download complete');

            // Store metadata
            $audio.webAudio.duration = msePlayer.getDuration();
            console.log('⏱️  Duration:', $audio.webAudio.duration?.toFixed(2), 'seconds');

            // Auto-play if enabled
            if ($audio.autoPlayAudio) {
                await playWebAudio();
            }
        } catch (error) {
            console.error('❌ Failed to download audio:', error);
        }
    };

    const streamAudio = async () => {
        if (!demoModule) return;

        try {
            console.log('🌊 Starting progressive streaming audio...');

            // Create streaming player if needed
            if (!streamingPlayer) {
                streamingPlayer = new StreamingAudioPlayer();
            }

            $audio.streamingAudio.isStreaming = true;
            $audio.streamingAudio.bytesReceived = 0;

            // Get ReadableStream from server
            const stream: ReadableStream<Uint8Array> = await demoModule.streamAudio();
            const reader = stream.getReader();

            // Feed chunks to streaming player
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                await streamingPlayer.appendChunk(value);
                $audio.streamingAudio.bytesReceived += value.byteLength;
                console.log('🌊 Streaming chunk:', value.byteLength, 'bytes, Total:', $audio.streamingAudio.bytesReceived);
            }

            // Finalize the stream
            streamingPlayer.endOfStream();
            $audio.streamingAudio.isStreaming = false;
            console.log('✅ Streaming complete');

            // Store metadata
            $audio.streamingAudio.duration = streamingPlayer.getDuration();
            console.log('⏱️  Duration:', $audio.streamingAudio.duration?.toFixed(2), 'seconds');

            // Auto-play if enabled
            if ($audio.autoPlayAudio) {
                streamingPlayer.play();
                $audio.streamingAudio.isPlaying = true;
            }
        } catch (error) {
            console.error('❌ Failed to stream audio:', error);
            $audio.streamingAudio.isStreaming = false;
        }
    };

    const playStreamingAudio = () => {
        if (!streamingPlayer) return;

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

    const stopStreamingAudio = () => {
        if (!streamingPlayer) return;

        streamingPlayer.stop();
        $audio.streamingAudio.isPlaying = false;
        $audio.streamingAudio.isPaused = false;
        $audio.streamingAudio.isStreaming = false;
        console.log('⏹️  Streaming audio stopped');
    };

    return (
        <div className="audio-demo-container">
            <h2>🎵 Audio Features Demo</h2>

            <div className="demo-section">
                <h3>🎵 Audio Download & Playback (HTML5)</h3>
                <div className="button-group">
                    <button
                        onClick={downloadAudio}
                        disabled={!isLoggedIn}
                    >
                        Download & Play Audio (HTML5)
                    </button>
                </div>
                <div className="info-box">
                    <p>Downloads complete audio file and plays using HTML5 {'<audio>'} element.</p>
                    <p>Simple but requires full download before playback.</p>
                </div>
            </div>

            <div className="demo-section">
                <h3>🎛️ Web Audio API Playback</h3>
                <div className="button-group">
                    <button
                        onClick={downloadWebAudio}
                        disabled={!isLoggedIn}
                    >
                        Download for Web Audio
                    </button>
                    <button
                        onClick={playWebAudio}
                        disabled={!$audio.hasWebAudioData || $audio.webAudio.isPlaying}
                    >
                        ▶️ Play
                    </button>
                    <button
                        onClick={pauseWebAudio}
                        disabled={!$audio.webAudio.isPlaying}
                    >
                        ⏸️ Pause
                    </button>
                    <button
                        onClick={resumeWebAudio}
                        disabled={!$audio.webAudio.isPaused}
                    >
                        ▶️ Resume
                    </button>
                    <button
                        onClick={stopWebAudio}
                        disabled={!$audio.webAudio.isPlaying && !$audio.webAudio.isPaused}
                    >
                        ⏹️ Stop
                    </button>
                </div>
                <div className="info-box">
                    <p>Uses Media Source Extensions (MSE) for advanced audio control.</p>
                    <p><strong>State:</strong> {$audio.webAudioState}</p>
                    {$audio.webAudio.duration && (
                        <p><strong>Duration:</strong> {$audio.webAudio.duration.toFixed(2)}s</p>
                    )}
                </div>
            </div>

            <div className="demo-section">
                <h3>🌊 Progressive Streaming Audio (ReadableStream)</h3>
                <div className="button-group">
                    <button
                        onClick={streamAudio}
                        disabled={!isLoggedIn || $audio.streamingAudio.isStreaming}
                    >
                        {$audio.streamingAudio.isStreaming ? '🌊 Streaming...' : 'Start Streaming'}
                    </button>
                    <button
                        onClick={playStreamingAudio}
                        disabled={!$audio.hasStreamingAudioData || $audio.streamingAudio.isPlaying || $audio.streamingAudio.isStreaming}
                    >
                        ▶️ Play
                    </button>
                    <button
                        onClick={pauseStreamingAudio}
                        disabled={!$audio.streamingAudio.isPlaying}
                    >
                        ⏸️ Pause
                    </button>
                    <button
                        onClick={stopStreamingAudio}
                        disabled={!$audio.streamingAudio.isPlaying && !$audio.streamingAudio.isPaused}
                    >
                        ⏹️ Stop
                    </button>
                </div>
                <div className="info-box">
                    <p>Streams audio progressively, plays as data arrives!</p>
                    <p><strong>State:</strong> {$audio.streamingAudioState}</p>
                    {$audio.streamingProgressDisplay && (
                        <p><strong>Received:</strong> {$audio.streamingProgressDisplay}</p>
                    )}
                    {$audio.streamingAudio.duration && (
                        <p><strong>Duration:</strong> {$audio.streamingAudio.duration.toFixed(2)}s</p>
                    )}
                </div>
                <div className="info-box" style={{ backgroundColor: '#e3f2fd', borderColor: '#2196f3' }}>
                    <label>
                        <input
                            type="checkbox"
                            checked={$audio.autoPlayAudio}
                            onChange={(e) => ($audio.autoPlayAudio = e.target.checked)}
                        />
                        {' '}Auto-play audio (saved to localStorage)
                    </label>
                </div>
            </div>
        </div>
    );
}

