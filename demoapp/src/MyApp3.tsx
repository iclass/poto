import { PotoClient } from "poto";
import { Constants, ServerInfo, GenData, ImageSize } from "./demoConsts";
import type { DemoModule } from "./DemoModule";
import { makeState } from "./ReactiveState";
import { MSEAudioPlayer } from "./MSEAudioPlayer";
import { StreamingAudioPlayer } from "./StreamingAudioPlayer";

// Store MSE player at module level to persist across renders
let msePlayer: MSEAudioPlayer | undefined;
// Store streaming player at module level
let streamingPlayer: StreamingAudioPlayer | undefined;

export function MyApp3({
    host = 'http://localhost' as string, port = Constants.port as number
}) {
    const SessionData = "stored in seesion";

    // ═════════════════════════════════════════════════════════════════════════════
    // MULTIPLE STATE OBJECTS - Separation of Concerns!
    // ═════════════════════════════════════════════════════════════════════════════
    // Instead of one huge state object, we split into focused, independent states:
    // • Each has its own debounce/batch/watch settings
    // • Each re-renders independently
    // • Much easier to reason about and maintain!

    // ─────────────────────────────────────────────────────────────────────────────
    // CONNECTION & AUTH STATE - Core infrastructure
    // ─────────────────────────────────────────────────────────────────────────────
    // ═════════════════════════════════════════════════════════════════════════════
    // FLUENT BUILDER API - Initialize, setup cleanup, and watch in one chain!
    // ═════════════════════════════════════════════════════════════════════════════
    const potoClient = new PotoClient(`${host}:${port}`);
    const savedUser = localStorage.getItem('myapp3:lastUser') || '';
    
    console.log('✅ Poto client initialized');
    if (savedUser) console.log('📂 Restored user:', savedUser);
    
    const $core = makeState({
        client: potoClient,
        demoModule: potoClient.getProxy(Constants.serverModuleName) as DemoModule,
        currentUser: savedUser,

        // Computed values
        get isConnected() {
            return !!this.client && !!this.demoModule;
        },
        get isLoggedIn() {
            return !!this.currentUser;
        },
    } as {
        client: PotoClient;
        demoModule: DemoModule;
        currentUser: string;
        readonly isConnected: boolean;
        readonly isLoggedIn: boolean;
    })
    .$withCleanup(() => {
        potoClient.unsubscribe();
        console.log('🧹 Poto client cleaned up');
    })
    .$withWatch({
        currentUser: (user, prevUser) => {
            if (user) {
                localStorage.setItem('myapp3:lastUser', user);
                console.log('💾 [$core] User saved:', user);
            } else if (prevUser) {
                localStorage.removeItem('myapp3:lastUser');
                console.log('🗑️  [$core] User removed');
            }
        },
    });



    const $ui = makeState(() => {
        // ─────────────────────────────────────────────────────────────────────────────
        // UI STATE - Form inputs, loading state, file selection
        // ─────────────────────────────────────────────────────────────────────────────
        const savedDraft = localStorage.getItem('myapp3:messageDraft');
        if (savedDraft) console.log('📂 Restored message draft');

        return {
            state: {
                loading: false,
                messageInput: savedDraft || 'Hello from the frontend!',
                selectedFile: null as File | null,

                // Computed values
                get canInteract(): boolean {
                    return !this.loading && $core.isConnected && $core.isLoggedIn;
                },
                get hasFile(): boolean {
                    return !!this.selectedFile;
                },
                get canUpload(): boolean {
                    return this.canInteract && this.hasFile;
                },
                get fileDisplaySize(): string {
                    if (!this.selectedFile) return '';
                    const bytes: number = this.selectedFile.size;
                    if (bytes < 1024) return `${bytes} B`;
                    const kb = bytes / 1024;
                    if (kb < 1024) return `${kb.toFixed(2)} KB`;
                    return `${(kb / 1024).toFixed(2)} MB`;
                },
            }
        }
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // API RESULTS STATE - All server call results
    // ─────────────────────────────────────────────────────────────────────────────
    const $api = makeState({
        results: {
            greeting: undefined as string | undefined,
            echo: undefined as string | undefined,
            serverInfo: undefined as ServerInfo | undefined,
            streamData: [] as GenData[] | undefined,
            imageSize: undefined as ImageSize | undefined,
            adminSecret: undefined as any,
            error: undefined as string | undefined,
            uploadTiming: undefined as { totalTime: number; rpcTime: number; fileSize: number } | undefined,
        },
        downloadResults: {
            fileUrl: undefined as string | undefined,
            audioUrl: undefined as string | undefined,
            arrayBufferUrl: undefined as string | undefined,
            staticUrl: undefined as string | undefined,
            arrayBufferTime: undefined as number | undefined,
            fileTime: undefined as number | undefined,
            staticUrlTime: undefined as number | undefined,
            fileSize: undefined as number | undefined,
        },

        // Computed values
        get hasError(): boolean {
            return !!$api.results.error;
        },
        get hasResults(): boolean {
            return !!($api.results.greeting || $api.results.echo || $api.results.serverInfo);
        },
        get hasStreamData(): boolean {
            return !!($api.results.streamData && $api.results.streamData.length > 0);
        },
        get uploadSpeedMbps(): string {
            if (!$api.results.uploadTiming || !$api.results.uploadTiming.rpcTime) return '';
            const bytesPerSec: number = $api.results.uploadTiming.fileSize / ($api.results.uploadTiming.rpcTime / 1000);
            return `${(bytesPerSec * 8 / 1024 / 1024).toFixed(2)} Mbps`;
        },
        get hasDownloadResults(): boolean {
            return !!($api.downloadResults.fileUrl || $api.downloadResults.audioUrl);
        },
        get downloadSpeedMbps(): string {
            if (!$api.downloadResults.fileSize || !$api.downloadResults.fileTime) return '';
            const bytesPerSec: number = $api.downloadResults.fileSize / ($api.downloadResults.fileTime / 1000);
            return `${(bytesPerSec * 8 / 1024 / 1024).toFixed(2)} Mbps`;
        },
        get downloadDisplaySize(): string {
            if (!$api.downloadResults.fileSize) return '';
            const bytes: number = $api.downloadResults.fileSize;
            if (bytes < 1024) return `${bytes} B`;
            const kb = bytes / 1024;
            if (kb < 1024) return `${kb.toFixed(2)} KB`;
            return `${(kb / 1024).toFixed(2)} MB`;
        },
    })

    const $audio = makeState(() => {
        // ─────────────────────────────────────────────────────────────────────────────
        // AUDIO STATE - Web Audio & Streaming Audio players
        // ─────────────────────────────────────────────────────────────────────────────
        const savedAudioPref = localStorage.getItem('myapp3:autoPlayAudio');
        if (savedAudioPref !== null) console.log('📂 Restored audio preference:', savedAudioPref);
        return {
            state: {
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
                    if (this.webAudio.isPlaying) return 'playing';
                    if (this.webAudio.isPaused) return 'paused';
                    return 'stopped';
                },
                get streamingAudioState(): 'streaming' | 'playing' | 'paused' | 'stopped' {
                    if (this.streamingAudio.isStreaming) return 'streaming';
                    if (this.streamingAudio.isPlaying) return 'playing';
                    if (this.streamingAudio.isPaused) return 'paused';
                    return 'stopped';
                },
                get hasWebAudioData(): boolean {
                    return this.webAudio.duration !== undefined;
                },
                get hasStreamingAudioData(): boolean {
                    return this.streamingAudio.duration !== undefined;
                },
                get streamingProgressDisplay(): string {
                    if (!this.streamingAudio.bytesReceived) return '';
                    const kb: number = this.streamingAudio.bytesReceived / 1024;
                    if (kb < 1024) return `${kb.toFixed(2)} KB`;
                    return `${(kb / 1024).toFixed(2)} MB`;
                },
            }
        }
    });

    // ═════════════════════════════════════════════════════════════════════════════
    // PROPERTY WATCHERS - Each state object can have its own watchers!
    // ═════════════════════════════════════════════════════════════════════════════


    // Watch $ui for draft persistence
    $ui.$watch({
        messageInput: {
            handler: (message) => {
                if (message) {
                    localStorage.setItem('myapp3:messageDraft', message);
                    console.log('💾 [$ui] Draft saved (length:', message.length, ')');
                }
            },
            debounce: 500
        },
    });

    // Watch $audio for preference persistence
    $audio.$watch({
        autoPlayAudio: (enabled) => {
            localStorage.setItem('myapp3:autoPlayAudio', String(enabled));
            console.log('💾 [$audio] Preference saved:', enabled ? 'ON' : 'OFF');
        },
    });


    const login = async (username: string, password: string) => {
        if (!$core.client) return;

        // Direct assignment - UI updates automatically!
        $ui.loading = true;

        try {
            await $core.client.login({ username, password });

            // Direct assignments - each triggers UI update
            $core.currentUser = username;
            $api.results.error = undefined;

            console.log(`✅ Successfully logged in as ${username}`);
        } catch (error) {
            console.error('❌ Login failed:', error);
            $api.results.error = `Login failed: ${error}`;
        } finally {
            $ui.loading = false;
        }
    };

    const getGreeting = async () => {
        if (!$core.demoModule) return;

        $ui.loading = true;
        try {
            const greeting = await $core.demoModule.hello_(SessionData);
            $api.results.greeting = greeting;
            $api.results.error = undefined;
        } catch (error) {
            console.error('❌ Failed to get greeting:', error);
            $api.results.error = `Failed to get greeting: ${error}`;
        } finally {
            $ui.loading = false;
        }
    };

    const sendMessage = async () => {
        if (!$core.demoModule) return;

        $ui.loading = true;
        try {
            const echo = await $core.demoModule.postMessage_($ui.messageInput);
            $api.results.echo = echo;
            $api.results.error = undefined;
            if (!echo.includes(SessionData)) {
                console.error('❌ Failed to retrieve session data in: ' + echo);
                $api.results.error = `failed to retrieve session data`;
            }
        } catch (error) {
            console.error('❌ Failed to send message:', error);
            $api.results.error = `Failed to send message: ${error}`;
        } finally {
            $ui.loading = false;
        }
    };

    const getServerInfo = async () => {
        if (!$core.demoModule) return;

        $ui.loading = true;
        try {
            const serverInfo = await $core.demoModule.getServerInfo();
            $api.results.serverInfo = serverInfo;
            $api.results.error = undefined;
        } catch (error) {
            console.error('❌ Failed to get server info:', error);
            $api.results.error = `Failed to get server info: ${error}`;
        } finally {
            $ui.loading = false;
        }
    };

    const testStream = async () => {
        if (!$core.demoModule) return;

        $ui.loading = true;
        $api.results.streamData = [];
        $api.results.error = undefined;


        try {
            const stream = await $core.demoModule.testStream(3);
            for await (const item of stream) {
                // Direct assignment - UI updates in real-time!
                $api.results.streamData.push(item);
            }
        } catch (error) {
            console.error('❌ Failed to test stream:', error);
            $api.results.error = `Failed to test stream: ${error}`;
        } finally {
            $ui.loading = false;
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        $ui.selectedFile = file || null;
    };

    const getImageSize = async () => {
        if (!$core.demoModule || !$ui.selectedFile) return;

        $ui.loading = true;
        const startTotal = performance.now();

        try {
            const arrayBuffer = await $ui.selectedFile.arrayBuffer();
            const imageBuffer = new Uint8Array(arrayBuffer);

            const startRpc = performance.now();
            const imageSize = await $core.demoModule.getImageSize(imageBuffer);
            const rpcTime = performance.now() - startRpc;

            const totalTime = performance.now() - startTotal;

            $api.results = {
                ...$api.results,
                imageSize,
                uploadTiming: { totalTime, rpcTime, fileSize: $ui.selectedFile.size },
                error: undefined
            };
        } catch (error) {
            console.error('Failed to get image size:', error);
            $api.results.error = `Failed to get image size: ${error}`;
        } finally {
            $ui.loading = false;
        }
    };

    const getImageSizeArrayBuffer = async () => {
        if (!$core.demoModule || !$ui.selectedFile) return;

        $ui.loading = true;
        const startTotal = performance.now();

        try {
            const arrayBuffer = await $ui.selectedFile.arrayBuffer();

            const startRpc = performance.now();
            const imageSize = await $core.demoModule.getImageSizeArrayBuffer(arrayBuffer);
            const rpcTime = performance.now() - startRpc;

            const totalTime = performance.now() - startTotal;

            $api.results = {
                ...$api.results,
                imageSize,
                uploadTiming: { totalTime, rpcTime, fileSize: $ui.selectedFile.size },
                error: undefined
            };
        } catch (error) {
            console.error('Failed to get image size:', error);
            $api.results.error = `Failed to get image size: ${error}`;
        } finally {
            $ui.loading = false;
        }
    }

    const getImageSizeDirectFile = async () => {
        if (!$core.demoModule || !$ui.selectedFile) return;

        $ui.loading = true;
        const startTotal = performance.now();

        try {
            const startRpc = performance.now();
            const imageSize = await $core.demoModule.getImageSizeFile($ui.selectedFile);
            const rpcTime = performance.now() - startRpc;

            const totalTime = performance.now() - startTotal;

            $api.results = {
                ...$api.results,
                imageSize,
                uploadTiming: { totalTime, rpcTime, fileSize: $ui.selectedFile.size },
                error: undefined
            };
        } catch (error) {
            console.error('Failed to get image size:', error);
            $api.results.error = `Failed to get image size: ${error}`;
        } finally {
            $ui.loading = false;
        }
    }

    const testAdminSecret = async () => {
        if (!$core.demoModule) return;

        $ui.loading = true;
        try {
            const adminSecret = await $core.demoModule.getAdminSecret();
            $api.results.adminSecret = adminSecret;
            $api.results.error = undefined;
        } catch (error) {
            console.error('❌ Failed to get admin secret:', error);
            $api.results.error = `Failed to get admin secret: ${error}`;
        } finally {
            $ui.loading = false;
        }
    };

    // Centralized function to stop all audio players
    const stopAllPlayers = () => {
        // Stop HTML5 audio element
        const audioElement = document.querySelector('audio');
        if (audioElement) {
            audioElement.pause();
            audioElement.currentTime = 0;
        }

        // Clean up MSE player
        if (msePlayer) {
            msePlayer.cleanup();
            msePlayer = undefined;
        }

        // Clean up streaming player
        if (streamingPlayer) {
            streamingPlayer.cleanup();
            streamingPlayer = undefined;
        }

        // Reset all audio state
        $audio.webAudio = {
            isPlaying: false,
            isPaused: false,
            duration: undefined,
            sampleRate: undefined,
            channels: undefined,
            startTime: 0,
            pauseTime: 0,
        };

        $audio.streamingAudio = {
            isPlaying: false,
            isPaused: false,
            duration: undefined,
            bytesReceived: 0,
            isStreaming: false,
        };
    };

    const clearResults = () => {
        // Clean up URLs to prevent memory leaks
        if ($api.downloadResults.fileUrl) {
            URL.revokeObjectURL($api.downloadResults.fileUrl);
        }
        if ($api.downloadResults.audioUrl) {
            URL.revokeObjectURL($api.downloadResults.audioUrl);
        }

        // Stop all players
        stopAllPlayers();


        $api.results = {
            greeting: undefined,
            echo: undefined,
            serverInfo: undefined,
            streamData: undefined,
            imageSize: undefined,
            adminSecret: undefined,
            error: undefined,
            uploadTiming: undefined,
        };

        $api.downloadResults = {
            fileUrl: undefined,
            audioUrl: undefined,
            arrayBufferUrl: undefined,
            staticUrl: undefined,
            arrayBufferTime: undefined,
            fileTime: undefined,
            staticUrlTime: undefined,
            fileSize: undefined,
        };

        $audio.webAudio = {
            isPlaying: false,
            isPaused: false,
            duration: undefined,
            sampleRate: undefined,
            channels: undefined,
            startTime: 0,
            pauseTime: 0,
        };

        $audio.streamingAudio = {
            isPlaying: false,
            isPaused: false,
            duration: undefined,
            bytesReceived: 0,
            isStreaming: false,
        };
    };

    const downloadAsFile = async () => {
        if (!$core.demoModule) return;

        $ui.loading = true;
        try {
            const startTime = performance.now();
            const file = await $core.demoModule.downloadImageAsFile();
            const downloadTime = performance.now() - startTime;

            const fileUrl = URL.createObjectURL(file);

            $api.$batch(() => { // here to demo batch update to avoid UI stress
                $api.downloadResults.fileUrl = fileUrl;
                $api.downloadResults.fileTime = downloadTime;
                $api.downloadResults.fileSize = file.size;
                $api.results.error = undefined;
            });
        } catch (error) {
            console.error('Download as File failed:', error);
            $api.results.error = `Download as File failed: ${error}`;
        } finally {
            $ui.loading = false;
        }
    };

    const downloadAsArrayBuffer = async () => {
        if (!$core.demoModule) return;

        $ui.loading = true;
        try {

            const startTime = performance.now();
            const arrayBuffer = await $core.demoModule.downloadImageAsArrayBuffer();
            const downloadTime = performance.now() - startTime;

            // Create object URL for display
            const blob = new Blob([arrayBuffer], { type: 'image/png' });
            const arrayBufferUrl = URL.createObjectURL(blob);

            $api.$batch(() => {
                $api.downloadResults.arrayBufferUrl = arrayBufferUrl;
                $api.downloadResults.arrayBufferTime = downloadTime;
                $api.downloadResults.fileSize = arrayBuffer.byteLength;
                $api.results.error = undefined;
            });

        } catch (error) {
            console.error('❌ Download as ArrayBuffer failed:', error);
            $api.results.error = `Download as ArrayBuffer failed: ${error}`;
        } finally {
            $ui.loading = false;
        }
    };

    const downloadViaStaticUrl = () => {
        $ui.loading = true;
        try {
            const startTime = performance.now();

            // Use static URL directly from public folder
            $api.downloadResults.staticUrl = '/logo.jpg';
            const downloadTime = performance.now() - startTime;

            $api.downloadResults.staticUrlTime = downloadTime;
            $api.results.error = undefined;
        } catch (error) {
            console.error('Download via Static URL failed:', error);
            $api.results.error = `Download via Static URL failed: ${error}`;
        } finally {
            $ui.loading = false;
        }
    };



    const downloadAudio = async () => {
        if (!$core.demoModule) return;

        // Stop all other players before starting HTML5 audio
        stopAllPlayers();

        $ui.loading = true;
        try {
            const audioBlob = await $core.demoModule.downloadAudioFile();
            const audioUrl = URL.createObjectURL(audioBlob);

            $api.downloadResults.audioUrl = audioUrl;
            $api.results.error = undefined;
        } catch (error) {
            console.error('Download audio failed:', error);
            $api.results.error = `Download audio failed: ${error}`;
        } finally {
            $ui.loading = false;
        }
    };

    const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        $ui.messageInput = e.target.value;
    };

    const downloadAndPlayWithWebAudio = async () => {
        if (!$core.demoModule) return;

        // Stop all other players before starting MSE player
        stopAllPlayers();

        $ui.loading = true;
        try {
            const audioBlob = await $core.demoModule.downloadAudioFile();

            // Create and use MSE player for low-latency streaming
            msePlayer = new MSEAudioPlayer();

            await msePlayer.loadAndPlay(
                audioBlob,
                // On playback start
                () => {
                    $audio.webAudio.isPlaying = true;
                    $audio.webAudio.isPaused = false;
                    $ui.loading = false;
                },
                // On metadata loaded
                (duration) => {
                    $audio.webAudio.duration = duration;
                    $audio.webAudio.sampleRate = 48000; // MP3 typical
                    $audio.webAudio.channels = 2; // Stereo typical
                },
                // On ended
                () => {
                    $audio.webAudio.isPlaying = false;
                    $audio.webAudio.isPaused = false;
                }
            );

            $api.results.error = undefined;
        } catch (error) {
            console.error('❌ MSE streaming failed:', error);
            $api.results.error = `MSE streaming failed: ${error}`;
            $ui.loading = false;
        }
    };

    const playWebAudio = async () => {
        if (!msePlayer) return;

        if ($audio.webAudio.isPaused) {
            // Resume from pause
            msePlayer.play();
            $audio.webAudio.isPlaying = true;
            $audio.webAudio.isPaused = false;
        } else {
            // Restart from beginning
            msePlayer.restart();
            $audio.webAudio.isPlaying = true;
            $audio.webAudio.isPaused = false;
        }
    };

    const pauseWebAudio = async () => {
        if (!$audio.webAudio.isPlaying || !msePlayer) return;

        try {
            msePlayer.pause();
            $audio.webAudio.isPlaying = false;
            $audio.webAudio.isPaused = true;
        } catch (error: any) {
            console.error('❌ Pause failed:', error);
            $api.results.error = `Pause failed: ${error}`;
        }
    };

    const stopWebAudio = () => {
        if (!msePlayer) return;

        try {
            msePlayer.stop();
            $audio.webAudio.isPlaying = false;
            $audio.webAudio.isPaused = false;
            $audio.webAudio.pauseTime = 0;
            $audio.webAudio.startTime = 0;
        } catch (error) {
            console.error('❌ Stop failed:', error);
            // Reset state on error
            $audio.webAudio.isPlaying = false;
            $audio.webAudio.isPaused = false;
            $audio.webAudio.pauseTime = 0;
        }
    };

    const streamAndPlayAudio = async () => {
        if (!$core.demoModule) return;

        // Stop all other players before starting streaming player
        stopAllPlayers();

        $ui.loading = true;
        $audio.streamingAudio.bytesReceived = 0;
        $audio.streamingAudio.isStreaming = true;

        try {
            // Create new streaming player
            streamingPlayer = new StreamingAudioPlayer();

            // Get the audio stream from server (Bun streams natively)
            const audioStream = await $core.demoModule.streamAudioFile();

            // Stream and play
            await streamingPlayer.streamAndPlay(
                audioStream,
                // On playback start
                () => {
                    $audio.streamingAudio.isPlaying = true;
                    $audio.streamingAudio.isPaused = false;
                    $ui.loading = false;
                    console.log('🎵 Streaming playback started!');
                },
                // On metadata loaded
                (duration) => {
                    $audio.streamingAudio.duration = duration;
                    console.log(`🎵 Audio duration: ${duration.toFixed(2)}s`);
                },
                // On ended
                () => {
                    $audio.streamingAudio.isPlaying = false;
                    $audio.streamingAudio.isPaused = false;
                    $audio.streamingAudio.isStreaming = false;
                    console.log('🎵 Streaming playback ended');
                },
                // On progress
                (bytesReceived) => {
                    $audio.streamingAudio.bytesReceived = bytesReceived;
                }
            );

            $audio.streamingAudio.isStreaming = false;
            $api.results.error = undefined;
        } catch (error) {
            console.error('❌ Streaming playback failed:', error);
            $api.results.error = `Streaming playback failed: ${error}`;
            $audio.streamingAudio.isStreaming = false;
            $ui.loading = false;
        }
    };

    const playStreamingAudio = () => {
        if (!streamingPlayer) return;

        if ($audio.streamingAudio.isPaused) {
            streamingPlayer.play();
            $audio.streamingAudio.isPlaying = true;
            $audio.streamingAudio.isPaused = false;
        } else {
            streamingPlayer.restart();
            $audio.streamingAudio.isPlaying = true;
            $audio.streamingAudio.isPaused = false;
        }
    };

    const pauseStreamingAudio = () => {
        if (!$audio.streamingAudio.isPlaying || !streamingPlayer) return;

        streamingPlayer.pause();
        $audio.streamingAudio.isPlaying = false;
        $audio.streamingAudio.isPaused = true;
    };

    const stopStreamingAudio = () => {
        if (!streamingPlayer) return;

        streamingPlayer.stop();
        $audio.streamingAudio.isPlaying = false;
        $audio.streamingAudio.isPaused = false;
    };


    return (
        <div className="container">
            <h1>🚀🚀Poto Demo Frontend (Proxy Reactive) </h1>

            <div className="info">
                <h3>Connection Status 📡</h3>
                <p><strong>Status:</strong> {$core.isConnected ? '✅ Connected' : '❌ Disconnected'}</p>
                <p><strong>Port:</strong> {Constants.port}</p>
                <p><strong>Current User:</strong> {$core.currentUser || 'Not logged in'}</p>
            </div>

            <div className="info" style={{ backgroundColor: '#e8f5e9', borderColor: '#4caf50' }}>
                <h3>🔍 Property Watchers Demo</h3>
                <p><small>
                    Active watchers: <strong>currentUser</strong>, <strong>messageInput</strong>, <strong>autoPlayAudio</strong>
                </small></p>
                <p><small>
                    ✅ Check console to see watchers firing!<br />
                    ✅ Refresh page to see persisted values restored<br />
                    ✅ Message draft has 500ms debounce (stop typing to trigger)
                </small></p>
            </div>

            {$api.results.error && (
                <div className="error">
                    <h3>❌ Error</h3>
                    <p>{$api.results.error}</p>
                </div>
            )}

            <div className="demo-section">
                <h3>🔐 Authentication</h3>
                <div className="button-group">
                    <button
                        onClick={() => login(Constants.demoUser, Constants.demoPassword)}
                        disabled={$ui.loading || !$core.isConnected}
                    >
                        Login as Demo User
                    </button>
                    <button
                        onClick={() => login(Constants.adminUser, Constants.adminPassword)}
                        disabled={$ui.loading || !$core.isConnected}
                    >
                        Login as Admin
                    </button>
                </div>
            </div>

            <div className="demo-section">
                <h3>📝 Basic RPC Calls</h3>
                <div className="button-group">
                    <button
                        onClick={getGreeting}
                        disabled={!$ui.canInteract}
                    >
                        Get Greeting
                    </button>
                    <button
                        onClick={getServerInfo}
                        disabled={!$ui.canInteract}
                    >
                        Get Server Info
                    </button>
                </div>

                {$api.results.greeting && (
                    <div className="result">
                        <h4>📨 Greeting Response:</h4>
                        <p>{$api.results.greeting}</p>
                    </div>
                )}

                {$api.results.serverInfo && (
                    <div className="result">
                        <h4>📊 Server Info:</h4>
                        <pre>{JSON.stringify($api.results.serverInfo, null, 2)}</pre>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>💬 Message Echo</h3>
                <div className="input-group">
                    <input
                        type="text"
                        value={$ui.messageInput}
                        onChange={handleMessageInputChange}
                        placeholder="Enter a message..."
                        disabled={!$ui.canInteract} />
                    <button
                        onClick={sendMessage}
                        disabled={!$ui.canInteract}
                    >
                        Send Message
                    </button>
                </div>

                {$api.results.echo && (
                    <div className="result">
                        <h4>📨 Echo Response:</h4>
                        <p>{$api.results.echo}</p>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>🌊 Streaming Test</h3>
                <div className="button-group">
                    <button
                        onClick={testStream}
                        disabled={!$ui.canInteract}
                    >
                        Test Stream (3 items)
                    </button>
                </div>

                {$api.results.streamData && $api.results.streamData.length > 0 && (
                    <div className="result">
                        <h4>📨 Stream Data:</h4>
                        {$api.results.streamData.map((item, index) => (
                            <div key={index} className="stream-item">
                                <p><strong>Step {item.step}/{item.total}:</strong> {item.message}</p>
                                <p><small>User: {item.user} | Time: {item.timestamp}</small></p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>⬆️ Image Upload (One-Way - Client → Server)</h3>
                <p><small>Upload binary data to server. Server returns only size info (no echo).</small></p>
                <div className="input-group">
                    <input
                        type="file"
                        accept="image/png"
                        onChange={handleFileUpload}
                        disabled={!$ui.canInteract} />
                    <button
                        onClick={getImageSize}
                        disabled={!$ui.canUpload}
                    >
                        Upload (Uint8Array)
                    </button>
                    <button
                        onClick={getImageSizeArrayBuffer}
                        disabled={!$ui.canUpload}
                    >
                        Upload (ArrayBuffer)
                    </button>
                    <button
                        onClick={getImageSizeDirectFile}
                        disabled={!$ui.canUpload}
                    >
                        Upload (File) ✨
                    </button>
                </div>

                {$api.results.imageSize && (
                    <div className="result">
                        <h4>📐 Image Size (One-Way Upload):</h4>
                        <p>Width: {$api.results.imageSize.width}px | Height: {$api.results.imageSize.height}px</p>
                        <p><small>✅ Binary uploaded to server successfully! Server returned only dimensions (no echo).</small></p>
                        {$api.results.uploadTiming && (
                            <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #ddd' }}>
                                <p><strong>⏱️ Performance:</strong></p>
                                <p>• File size: {($api.results.uploadTiming.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                                <p>• RPC upload time: {$api.results.uploadTiming.rpcTime.toFixed(2)} ms</p>
                                <p>• Total round-trip time (upload + receive dimensions): <strong>{$api.results.uploadTiming.totalTime.toFixed(2)} ms</strong></p>
                                <p>• Upload throughput: {(($api.results.uploadTiming.fileSize / 1024 / 1024) / ($api.results.uploadTiming.rpcTime / 1000)).toFixed(2)} MB/s</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>⬇️ Image Download (Server → Client)</h3>
                <p><small>Download logo.jpg (6.8 MB) - compare RPC methods vs static URL serving</small></p>
                <div className="button-group">
                    <button
                        onClick={downloadAsFile}
                        disabled={!$ui.canInteract}
                    >
                        Download as File (RPC)
                    </button>
                    <button
                        onClick={downloadAsArrayBuffer}
                        disabled={!$ui.canInteract}
                    >
                        Download as ArrayBuffer (RPC)
                    </button>
                    <button
                        onClick={downloadViaStaticUrl}
                        disabled={$ui.loading}
                    >
                        Download via Static URL
                    </button>
                </div>

                {($api.downloadResults.fileTime || $api.downloadResults.arrayBufferTime || $api.downloadResults.staticUrlTime) && (
                    <div className="result">
                        <h4>📊 Download Performance Comparison:</h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f0f0f0' }}>
                                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Method</th>
                                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>Time</th>
                                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>Throughput</th>
                                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {$api.downloadResults.fileTime !== undefined && (
                                    <tr>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>File (RPC)</td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>
                                            {$api.downloadResults.fileTime.toFixed(2)} ms
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>
                                            {(($api.downloadResults.fileSize || 0) / 1024 / 1024 / ($api.downloadResults.fileTime / 1000)).toFixed(2)} MB/s
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                                            {(() => {
                                                const times = [$api.downloadResults.fileTime, $api.downloadResults.arrayBufferTime, $api.downloadResults.staticUrlTime].filter(t => t !== undefined) as number[];
                                                const minTime = Math.min(...times);
                                                return $api.downloadResults.fileTime === minTime ? '🏆 Fastest' : '✅';
                                            })()}
                                        </td>
                                    </tr>
                                )}
                                {$api.downloadResults.arrayBufferTime !== undefined && (
                                    <tr>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>ArrayBuffer (RPC)</td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>
                                            {$api.downloadResults.arrayBufferTime.toFixed(2)} ms
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>
                                            {(($api.downloadResults.fileSize || 0) / 1024 / 1024 / ($api.downloadResults.arrayBufferTime / 1000)).toFixed(2)} MB/s
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                                            {(() => {
                                                const times = [$api.downloadResults.fileTime, $api.downloadResults.arrayBufferTime, $api.downloadResults.staticUrlTime].filter(t => t !== undefined) as number[];
                                                const minTime = Math.min(...times);
                                                return $api.downloadResults.arrayBufferTime === minTime ? '🏆 Fastest' : '✅';
                                            })()}
                                        </td>
                                    </tr>
                                )}
                                {$api.downloadResults.staticUrlTime !== undefined && (
                                    <tr>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>Static URL</td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>
                                            {$api.downloadResults.staticUrlTime.toFixed(2)} ms
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>
                                            {(($api.downloadResults.fileSize || 0) / 1024 / 1024 / ($api.downloadResults.staticUrlTime / 1000)).toFixed(2)} MB/s
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                                            {(() => {
                                                const times = [$api.downloadResults.fileTime, $api.downloadResults.arrayBufferTime, $api.downloadResults.staticUrlTime].filter(t => t !== undefined) as number[];
                                                const minTime = Math.min(...times);
                                                return $api.downloadResults.staticUrlTime === minTime ? '🏆 Fastest' : '✅';
                                            })()}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        {$api.downloadResults.fileSize && (
                            <p style={{ marginTop: '10px' }}>
                                <small>File size: {($api.downloadResults.fileSize / (1024 * 1024)).toFixed(2)} MB ({$api.downloadResults.fileSize.toLocaleString()} bytes)</small>
                            </p>
                        )}
                    </div>
                )}

                {$api.downloadResults.fileUrl && (
                    <div className="result">
                        <h4>📥 Downloaded as File:</h4>
                        <img
                            src={$api.downloadResults.fileUrl}
                            alt="Downloaded as File"
                            style={{ maxWidth: '300px', border: '2px solid #2196F3', borderRadius: '8px' }}
                        />
                    </div>
                )}

                {$api.downloadResults.arrayBufferUrl && (
                    <div className="result">
                        <h4>📥 Downloaded as ArrayBuffer:</h4>
                        <img
                            src={$api.downloadResults.arrayBufferUrl}
                            alt="Downloaded as ArrayBuffer"
                            style={{ maxWidth: '300px', border: '2px solid #FF9800', borderRadius: '8px' }}
                        />
                    </div>
                )}

                {$api.downloadResults.staticUrl && (
                    <div className="result">
                        <h4>📥 Downloaded via Static URL:</h4>
                        <img
                            src={$api.downloadResults.staticUrl}
                            alt="Downloaded via Static URL"
                            style={{ maxWidth: '300px', border: '2px solid #4CAF50', borderRadius: '8px' }}
                        />
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>🔒 Admin-Only Method</h3>
                <div className="button-group">
                    <button
                        onClick={testAdminSecret}
                        disabled={!$ui.canInteract}
                    >
                        Get Admin Secret
                    </button>
                </div>

                {$api.results.adminSecret && (
                    <div className="result">
                        <h4>🔐 Admin Secret:</h4>
                        <pre>{JSON.stringify($api.results.adminSecret, null, 2)}</pre>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>🎵 Audio Download & Playback (HTML5)</h3>
                <div className="button-group" style={{ alignItems: 'center', gap: '10px' }}>
                    <button
                        onClick={downloadAudio}
                        disabled={!$ui.canInteract}
                    >
                        Download Audio
                    </button>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={$audio.autoPlayAudio}
                            onChange={(e) => $audio.autoPlayAudio = e.target.checked}
                            style={{ cursor: 'pointer' }}
                        />
                        Auto Play
                    </label>
                </div>

                {$api.downloadResults.audioUrl && (
                    <div className="result">
                        <audio
                            controls
                            autoPlay={$audio.autoPlayAudio}
                            src={$api.downloadResults.audioUrl}
                            style={{ width: '100%' }}
                            onPlay={() => {
                                // When HTML5 audio plays, stop other players
                                if (msePlayer) {
                                    msePlayer.cleanup();
                                    msePlayer = undefined;
                                    $audio.webAudio.isPlaying = false;
                                    $audio.webAudio.isPaused = false;
                                }
                                if (streamingPlayer) {
                                    streamingPlayer.cleanup();
                                    streamingPlayer = undefined;
                                    $audio.streamingAudio.isPlaying = false;
                                    $audio.streamingAudio.isPaused = false;
                                }
                            }}
                        />
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>🎛️ Web Audio API Playback</h3>
                <div className="button-group">
                    <button
                        onClick={downloadAndPlayWithWebAudio}
                        disabled={!$ui.canInteract}
                    >
                        Download and Play
                    </button>
                    <button
                        onClick={playWebAudio}
                        disabled={!$audio.webAudio.duration || $audio.webAudio.isPlaying}
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
                        onClick={stopWebAudio}
                        disabled={!$audio.webAudio.isPlaying && !$audio.webAudio.isPaused}
                    >
                        ⏹️ Stop
                    </button>
                </div>

                {$audio.webAudio.duration && (
                    <div className="result">
                        <p><strong>Duration:</strong> {$audio.webAudio.duration.toFixed(2)}s | <strong>State:</strong> {
                            $audio.webAudio.isPlaying ? '▶️ Playing' :
                                $audio.webAudio.isPaused ? '⏸️ Paused' :
                                    '⏹️ Stopped'
                        }</p>
                        <p><small>Sample rate: {$audio.webAudio.sampleRate}Hz | Channels: {$audio.webAudio.channels}</small></p>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>🌊 Progressive Streaming Audio (ReadableStream)</h3>
                <p><small>Server returns a pure ReadableStream that streams chunks over the network progressively</small></p>
                <div className="button-group">
                    <button
                        onClick={streamAndPlayAudio}
                        disabled={!$ui.canInteract}
                    >
                        🎵 Stream & Play
                    </button>
                    <button
                        onClick={playStreamingAudio}
                        disabled={!$audio.streamingAudio.duration || $audio.streamingAudio.isPlaying}
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

                {($audio.streamingAudio.isStreaming || $audio.streamingAudio.bytesReceived > 0) && (
                    <div className="result">
                        <h4>📊 Streaming Progress:</h4>
                        <p>
                            <strong>Bytes Received:</strong> {($audio.streamingAudio.bytesReceived / 1024 / 1024).toFixed(2)} MB
                            {$audio.streamingAudio.isStreaming && <span> 🔄 (streaming...)</span>}
                        </p>
                        {$audio.streamingAudio.duration && (
                            <p>
                                <strong>Duration:</strong> {$audio.streamingAudio.duration.toFixed(2)}s |
                                <strong> State:</strong> {
                                    $audio.streamingAudio.isPlaying ? ' ▶️ Playing' :
                                        $audio.streamingAudio.isPaused ? ' ⏸️ Paused' :
                                            ' ⏹️ Stopped'
                                }
                            </p>
                        )}
                        <p><small>💡 Audio starts playing as soon as first chunks arrive from server</small></p>
                    </div>
                )}
            </div>



            <div className="demo-section">
                <button onClick={clearResults} className="clear-button">
                    Clear All Results
                </button>
            </div>

            {$ui.loading && (
                <div className="loading">
                    <p>⏳ Loading...</p>
                </div>
            )}
        </div>
    );
}
