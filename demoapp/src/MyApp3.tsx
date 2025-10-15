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

    // Clean API - Pure TypeScript initialization with lazy initialization!
    const $ = makeState(() => {
        const potoClient = new PotoClient(`${host}:${port}`);
        const module = potoClient.getProxy(Constants.serverModuleName) as DemoModule;

        console.log('✅ Poto client initialized');

        return {
            state: {
                client: potoClient,
                demoModule: module,
                currentUser: '',
                loading: false,
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
                messageInput: 'Hello from the frontend!',
                selectedFile: null as File | null,
                autoPlayAudio: true,
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
                
                // ═══════════════════════════════════════════════════════════
                // COMPUTED VALUES - Auto-update, no manual sync needed!
                // ═══════════════════════════════════════════════════════════
                
                // Connection & Authentication
                get isConnected(): boolean {
                    return !!this.client && !!this.demoModule;
                },
                
                get isLoggedIn(): boolean {
                    return !!this.currentUser;
                },
                
                get canInteract(): boolean {
                    return !this.loading && this.isConnected && this.isLoggedIn;
                },
                
                // Results Status
                get hasError(): boolean {
                    return !!this.results.error;
                },
                
                get hasResults(): boolean {
                    return !!(this.results.greeting || this.results.echo || this.results.serverInfo);
                },
                
                get hasStreamData(): boolean {
                    return !!this.results.streamData && this.results.streamData.length > 0;
                },
                
                // File Upload
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
                
                get uploadSpeedMbps(): string {
                    if (!this.results.uploadTiming || !this.results.uploadTiming.rpcTime) return '';
                    const bytesPerSec: number = this.results.uploadTiming.fileSize / (this.results.uploadTiming.rpcTime / 1000);
                    return `${(bytesPerSec * 8 / 1024 / 1024).toFixed(2)} Mbps`;
                },
                
                // Download Stats
                get hasDownloadResults(): boolean {
                    return !!(this.downloadResults.fileUrl || this.downloadResults.audioUrl);
                },
                
                get downloadSpeedMbps(): string {
                    if (!this.downloadResults.fileSize || !this.downloadResults.fileTime) return '';
                    const bytesPerSec: number = this.downloadResults.fileSize / (this.downloadResults.fileTime / 1000);
                    return `${(bytesPerSec * 8 / 1024 / 1024).toFixed(2)} Mbps`;
                },
                
                get downloadDisplaySize(): string {
                    if (!this.downloadResults.fileSize) return '';
                    const bytes: number = this.downloadResults.fileSize;
                    if (bytes < 1024) return `${bytes} B`;
                    const kb = bytes / 1024;
                    if (kb < 1024) return `${kb.toFixed(2)} KB`;
                    return `${(kb / 1024).toFixed(2)} MB`;
                },
                
                // Audio States
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
            },
            cleanup: () => {
                potoClient.unsubscribe();
                console.log('🧹 Cleaned up client');
            }
        };
    });

    const login = async (username: string, password: string) => {
        if (!$.client) return;

        // Direct assignment - UI updates automatically!
        $.loading = true;

        try {
            await $.client.login({ username, password });

            // Direct assignments - each triggers UI update
            $.currentUser = username;
            $.results.error = undefined;

            console.log(`✅ Successfully logged in as ${username}`);
        } catch (error) {
            console.error('❌ Login failed:', error);
            $.results.error = `Login failed: ${error}`;
        } finally {
            $.loading = false;
        }
    };

    const getGreeting = async () => {
        if (!$.demoModule) return;

        $.loading = true;
        try {
            const greeting = await $.demoModule.hello_(SessionData);
            $.results.greeting = greeting;
            $.results.error = undefined;
        } catch (error) {
            console.error('❌ Failed to get greeting:', error);
            $.results.error = `Failed to get greeting: ${error}`;
        } finally {
            $.loading = false;
        }
    };

    const sendMessage = async () => {
        if (!$.demoModule) return;

        $.loading = true;
        try {
            const echo = await $.demoModule.postMessage_($.messageInput);
            $.results.echo = echo;
            $.results.error = undefined;
            if (!echo.includes(SessionData)) {
                console.error('❌ Failed to retrieve session data in: ' + echo);
                $.results.error = `failed to retrieve session data`;
            }
        } catch (error) {
            console.error('❌ Failed to send message:', error);
            $.results.error = `Failed to send message: ${error}`;
        } finally {
            $.loading = false;
        }
    };

    const getServerInfo = async () => {
        if (!$.demoModule) return;

        $.loading = true;
        try {
            const serverInfo = await $.demoModule.getServerInfo();
            $.results.serverInfo = serverInfo;
            $.results.error = undefined;
        } catch (error) {
            console.error('❌ Failed to get server info:', error);
            $.results.error = `Failed to get server info: ${error}`;
        } finally {
            $.loading = false;
        }
    };

    const testStream = async () => {
        if (!$.demoModule) return;

        $.loading = true;
        $.results.streamData = [];
        $.results.error = undefined;


        try {
            const stream = await $.demoModule.testStream(3);
            for await (const item of stream) {
                // Direct assignment - UI updates in real-time!
                $.results.streamData.push(item);
            }
        } catch (error) {
            console.error('❌ Failed to test stream:', error);
            $.results.error = `Failed to test stream: ${error}`;
        } finally {
            $.loading = false;
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        $.selectedFile = file || null;
    };

    const getImageSize = async () => {
        if (!$.demoModule || !$.selectedFile) return;

        $.loading = true;
        const startTotal = performance.now();
        
        try {
            const arrayBuffer = await $.selectedFile.arrayBuffer();
            const imageBuffer = new Uint8Array(arrayBuffer);
            
            const startRpc = performance.now();
            const imageSize = await $.demoModule.getImageSize(imageBuffer);
            const rpcTime = performance.now() - startRpc;
            
            const totalTime = performance.now() - startTotal;
            
            $.results = {
                ...$.results,
                imageSize,
                uploadTiming: { totalTime, rpcTime, fileSize: $.selectedFile.size },
                error: undefined
            };
        } catch (error) {
            console.error('Failed to get image size:', error);
            $.results.error = `Failed to get image size: ${error}`;
        } finally {
            $.loading = false;
        }
    };

    const getImageSizeArrayBuffer = async () => {
        if (!$.demoModule || !$.selectedFile) return;

        $.loading = true;
        const startTotal = performance.now();
        
        try {
            const arrayBuffer = await $.selectedFile.arrayBuffer();
            
            const startRpc = performance.now();
            const imageSize = await $.demoModule.getImageSizeArrayBuffer(arrayBuffer);
            const rpcTime = performance.now() - startRpc;
            
            const totalTime = performance.now() - startTotal;
            
            $.results = {
                ...$.results,
                imageSize,
                uploadTiming: { totalTime, rpcTime, fileSize: $.selectedFile.size },
                error: undefined
            };
        } catch (error) {
            console.error('Failed to get image size:', error);
            $.results.error = `Failed to get image size: ${error}`;
        } finally {
            $.loading = false;
        }
    }

    const getImageSizeDirectFile = async () => {
        if (!$.demoModule || !$.selectedFile) return;

        $.loading = true;
        const startTotal = performance.now();
        
        try {
            const startRpc = performance.now();
            const imageSize = await $.demoModule.getImageSizeFile($.selectedFile);
            const rpcTime = performance.now() - startRpc;
            
            const totalTime = performance.now() - startTotal;
            
            $.results = {
                ...$.results,
                imageSize,
                uploadTiming: { totalTime, rpcTime, fileSize: $.selectedFile.size },
                error: undefined
            };
        } catch (error) {
            console.error('Failed to get image size:', error);
            $.results.error = `Failed to get image size: ${error}`;
        } finally {
            $.loading = false;
        }
    }

    const testAdminSecret = async () => {
        if (!$.demoModule) return;

        $.loading = true;
        try {
            const adminSecret = await $.demoModule.getAdminSecret();
            $.results.adminSecret = adminSecret;
            $.results.error = undefined;
        } catch (error) {
            console.error('❌ Failed to get admin secret:', error);
            $.results.error = `Failed to get admin secret: ${error}`;
        } finally {
            $.loading = false;
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
        $.webAudio = {
            isPlaying: false,
            isPaused: false,
            duration: undefined,
            sampleRate: undefined,
            channels: undefined,
            startTime: 0,
            pauseTime: 0,
        };
        
        $.streamingAudio = {
            isPlaying: false,
            isPaused: false,
            duration: undefined,
            bytesReceived: 0,
            isStreaming: false,
        };
    };

    const clearResults = () => {
        // Clean up URLs to prevent memory leaks
        if ($.downloadResults.fileUrl) {
            URL.revokeObjectURL($.downloadResults.fileUrl);
        }
        if ($.downloadResults.audioUrl) {
            URL.revokeObjectURL($.downloadResults.audioUrl);
        }
        
        // Stop all players
        stopAllPlayers();
        
        
        $.results = {
            greeting: undefined,
            echo: undefined,
            serverInfo: undefined,
            streamData: undefined,
            imageSize: undefined,
            adminSecret: undefined,
            error: undefined,
            uploadTiming: undefined,
        };
        
        $.downloadResults = {
            fileUrl: undefined,
            audioUrl: undefined,
            arrayBufferUrl: undefined,
            staticUrl: undefined,
            arrayBufferTime: undefined,
            fileTime: undefined,
            staticUrlTime: undefined,
            fileSize: undefined,
        };
        
        $.webAudio = {
            isPlaying: false,
            isPaused: false,
            duration: undefined,
            sampleRate: undefined,
            channels: undefined,
            startTime: 0,
            pauseTime: 0,
        };
        
        $.streamingAudio = {
            isPlaying: false,
            isPaused: false,
            duration: undefined,
            bytesReceived: 0,
            isStreaming: false,
        };
    };

    const downloadAsFile = async () => {
        if (!$.demoModule) return;
        
        $.loading = true;
        try {
            const startTime = performance.now();
            const file = await $.demoModule.downloadImageAsFile();
            const downloadTime = performance.now() - startTime;
            
            const fileUrl = URL.createObjectURL(file);
            
            $.$batch(() => { // here to demo batch update to avoid UI stress
                $.downloadResults.fileUrl = fileUrl;
                $.downloadResults.fileTime = downloadTime;
                $.downloadResults.fileSize = file.size;
                $.results.error = undefined;
            });
        } catch (error) {
            console.error('Download as File failed:', error);
            $.results.error = `Download as File failed: ${error}`;
        } finally {
            $.loading = false;
        }
    };

    const downloadAsArrayBuffer = async () => {
        if (!$.demoModule) return;
        
        $.loading = true;
        try {
            
            const startTime = performance.now();
            const arrayBuffer = await $.demoModule.downloadImageAsArrayBuffer();
            const downloadTime = performance.now() - startTime;
            
            // Create object URL for display
            const blob = new Blob([arrayBuffer], { type: 'image/png' });
            const arrayBufferUrl = URL.createObjectURL(blob);
            
            $.$batch(() => {
                $.downloadResults.arrayBufferUrl = arrayBufferUrl;
                $.downloadResults.arrayBufferTime = downloadTime;
                $.downloadResults.fileSize = arrayBuffer.byteLength;
                $.results.error = undefined;
            });
            
        } catch (error) {
            console.error('❌ Download as ArrayBuffer failed:', error);
            $.results.error = `Download as ArrayBuffer failed: ${error}`;
        } finally {
            $.loading = false;
        }
    };

    const downloadViaStaticUrl = () => {
        $.loading = true;
        try {
            const startTime = performance.now();
            
            // Use static URL directly from public folder
            $.downloadResults.staticUrl = '/logo.jpg';
            const downloadTime = performance.now() - startTime;
            
            $.downloadResults.staticUrlTime = downloadTime;
            $.results.error = undefined;
        } catch (error) {
            console.error('Download via Static URL failed:', error);
            $.results.error = `Download via Static URL failed: ${error}`;
        } finally {
            $.loading = false;
        }
    };



    const downloadAudio = async () => {
        if (!$.demoModule) return;
        
        // Stop all other players before starting HTML5 audio
        stopAllPlayers();
        
        $.loading = true;
        try {
            const audioBlob = await $.demoModule.downloadAudioFile();
            const audioUrl = URL.createObjectURL(audioBlob);
            
            $.downloadResults.audioUrl = audioUrl;
            $.results.error = undefined;
        } catch (error) {
            console.error('Download audio failed:', error);
            $.results.error = `Download audio failed: ${error}`;
        } finally {
            $.loading = false;
        }
    };

    const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        $.messageInput = e.target.value;
    };

    const downloadAndPlayWithWebAudio = async () => {
        if (!$.demoModule) return;
        
        // Stop all other players before starting MSE player
        stopAllPlayers();
        
        $.loading = true;
        try {
            const audioBlob = await $.demoModule.downloadAudioFile();
            
            // Create and use MSE player for low-latency streaming
            msePlayer = new MSEAudioPlayer();
            
            await msePlayer.loadAndPlay(
                audioBlob,
                // On playback start
                () => {
                    $.webAudio.isPlaying = true;
                    $.webAudio.isPaused = false;
                    $.loading = false;
                },
                // On metadata loaded
                (duration) => {
                    $.webAudio.duration = duration;
                    $.webAudio.sampleRate = 48000; // MP3 typical
                    $.webAudio.channels = 2; // Stereo typical
                },
                // On ended
                () => {
                    $.webAudio.isPlaying = false;
                    $.webAudio.isPaused = false;
                }
            );
            
            $.results.error = undefined;
        } catch (error) {
            console.error('❌ MSE streaming failed:', error);
            $.results.error = `MSE streaming failed: ${error}`;
            $.loading = false;
        }
    };

    const playWebAudio = async () => {
        if (!msePlayer) return;
        
        if ($.webAudio.isPaused) {
            // Resume from pause
            msePlayer.play();
            $.webAudio.isPlaying = true;
            $.webAudio.isPaused = false;
        } else {
            // Restart from beginning
            msePlayer.restart();
            $.webAudio.isPlaying = true;
            $.webAudio.isPaused = false;
        }
    };

    const pauseWebAudio = async () => {
        if (!$.webAudio.isPlaying || !msePlayer) return;
        
        try {
            msePlayer.pause();
            $.webAudio.isPlaying = false;
            $.webAudio.isPaused = true;
        } catch (error: any) {
            console.error('❌ Pause failed:', error);
            $.results.error = `Pause failed: ${error}`;
        }
    };

    const stopWebAudio = () => {
        if (!msePlayer) return;
        
        try {
            msePlayer.stop();
            $.webAudio.isPlaying = false;
            $.webAudio.isPaused = false;
            $.webAudio.pauseTime = 0;
            $.webAudio.startTime = 0;
        } catch (error) {
            console.error('❌ Stop failed:', error);
            // Reset state on error
            $.webAudio.isPlaying = false;
            $.webAudio.isPaused = false;
            $.webAudio.pauseTime = 0;
        }
    };

    const streamAndPlayAudio = async () => {
        if (!$.demoModule) return;
        
        // Stop all other players before starting streaming player
        stopAllPlayers();
        
        $.loading = true;
        $.streamingAudio.bytesReceived = 0;
        $.streamingAudio.isStreaming = true;
        
        try {
            // Create new streaming player
            streamingPlayer = new StreamingAudioPlayer();
            
            // Get the audio stream from server (Bun streams natively)
            const audioStream = await $.demoModule.streamAudioFile();
            
            // Stream and play
            await streamingPlayer.streamAndPlay(
                audioStream,
                // On playback start
                () => {
                    $.streamingAudio.isPlaying = true;
                    $.streamingAudio.isPaused = false;
                    $.loading = false;
                    console.log('🎵 Streaming playback started!');
                },
                // On metadata loaded
                (duration) => {
                    $.streamingAudio.duration = duration;
                    console.log(`🎵 Audio duration: ${duration.toFixed(2)}s`);
                },
                // On ended
                () => {
                    $.streamingAudio.isPlaying = false;
                    $.streamingAudio.isPaused = false;
                    $.streamingAudio.isStreaming = false;
                    console.log('🎵 Streaming playback ended');
                },
                // On progress
                (bytesReceived) => {
                    $.streamingAudio.bytesReceived = bytesReceived;
                }
            );
            
            $.streamingAudio.isStreaming = false;
            $.results.error = undefined;
        } catch (error) {
            console.error('❌ Streaming playback failed:', error);
            $.results.error = `Streaming playback failed: ${error}`;
            $.streamingAudio.isStreaming = false;
            $.loading = false;
        }
    };

    const playStreamingAudio = () => {
        if (!streamingPlayer) return;
        
        if ($.streamingAudio.isPaused) {
            streamingPlayer.play();
            $.streamingAudio.isPlaying = true;
            $.streamingAudio.isPaused = false;
        } else {
            streamingPlayer.restart();
            $.streamingAudio.isPlaying = true;
            $.streamingAudio.isPaused = false;
        }
    };

    const pauseStreamingAudio = () => {
        if (!$.streamingAudio.isPlaying || !streamingPlayer) return;
        
        streamingPlayer.pause();
        $.streamingAudio.isPlaying = false;
        $.streamingAudio.isPaused = true;
    };

    const stopStreamingAudio = () => {
        if (!streamingPlayer) return;
        
        streamingPlayer.stop();
        $.streamingAudio.isPlaying = false;
        $.streamingAudio.isPaused = false;
    };


    return (
        <div className="container">
            <h1>🚀🚀Poto Demo Frontend (Proxy Reactive) </h1>

            <div className="info">
                <h3>Connection Status 📡</h3>
                <p><strong>Status:</strong> {$.isConnected ? '✅ Connected' : '❌ Disconnected'}</p>
                <p><strong>Port:</strong> {Constants.port}</p>
                <p><strong>Current User:</strong> {$.currentUser || 'Not logged in'}</p>
            </div>

            {$.results.error && (
                <div className="error">
                    <h3>❌ Error</h3>
                    <p>{$.results.error}</p>
                </div>
            )}

            <div className="demo-section">
                <h3>🔐 Authentication</h3>
                <div className="button-group">
                    <button
                        onClick={() => login(Constants.demoUser, Constants.demoPassword)}
                        disabled={$.loading || !$.isConnected}
                    >
                        Login as Demo User
                    </button>
                    <button
                        onClick={() => login(Constants.adminUser, Constants.adminPassword)}
                        disabled={$.loading || !$.isConnected}
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
                        disabled={!$.canInteract}
                    >
                        Get Greeting
                    </button>
                    <button
                        onClick={getServerInfo}
                        disabled={!$.canInteract}
                    >
                        Get Server Info
                    </button>
                </div>

                {$.results.greeting && (
                    <div className="result">
                        <h4>📨 Greeting Response:</h4>
                        <p>{$.results.greeting}</p>
                    </div>
                )}

                {$.results.serverInfo && (
                    <div className="result">
                        <h4>📊 Server Info:</h4>
                        <pre>{JSON.stringify($.results.serverInfo, null, 2)}</pre>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>💬 Message Echo</h3>
                <div className="input-group">
                    <input
                        type="text"
                        value={$.messageInput}
                        onChange={handleMessageInputChange}
                        placeholder="Enter a message..."
                        disabled={!$.canInteract} />
                    <button
                        onClick={sendMessage}
                        disabled={!$.canInteract}
                    >
                        Send Message
                    </button>
                </div>

                {$.results.echo && (
                    <div className="result">
                        <h4>📨 Echo Response:</h4>
                        <p>{$.results.echo}</p>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>🌊 Streaming Test</h3>
                <div className="button-group">
                    <button
                        onClick={testStream}
                        disabled={!$.canInteract}
                    >
                        Test Stream (3 items)
                    </button>
                </div>

                {$.results.streamData && $.results.streamData.length > 0 && (
                    <div className="result">
                        <h4>📨 Stream Data:</h4>
                        {$.results.streamData.map((item, index) => (
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
                        disabled={!$.canInteract} />
                    <button
                        onClick={getImageSize}
                        disabled={!$.canUpload}
                    >
                        Upload (Uint8Array)
                    </button>
                    <button
                        onClick={getImageSizeArrayBuffer}
                        disabled={!$.canUpload}
                    >
                        Upload (ArrayBuffer)
                    </button>
                    <button
                        onClick={getImageSizeDirectFile}
                        disabled={!$.canUpload}
                    >
                        Upload (File) ✨
                    </button>
                </div>

                {$.results.imageSize && (
                    <div className="result">
                        <h4>📐 Image Size (One-Way Upload):</h4>
                        <p>Width: {$.results.imageSize.width}px | Height: {$.results.imageSize.height}px</p>
                        <p><small>✅ Binary uploaded to server successfully! Server returned only dimensions (no echo).</small></p>
                        {$.results.uploadTiming && (
                            <div style={{marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #ddd'}}>
                                <p><strong>⏱️ Performance:</strong></p>
                                <p>• File size: {($.results.uploadTiming.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                                <p>• RPC upload time: {$.results.uploadTiming.rpcTime.toFixed(2)} ms</p>
                                <p>• Total round-trip time (upload + receive dimensions): <strong>{$.results.uploadTiming.totalTime.toFixed(2)} ms</strong></p>
                                <p>• Upload throughput: {(($.results.uploadTiming.fileSize / 1024 / 1024) / ($.results.uploadTiming.rpcTime / 1000)).toFixed(2)} MB/s</p>
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
                        disabled={!$.canInteract}
                    >
                        Download as File (RPC)
                    </button>
                    <button
                        onClick={downloadAsArrayBuffer}
                        disabled={!$.canInteract}
                    >
                        Download as ArrayBuffer (RPC)
                    </button>
                    <button
                        onClick={downloadViaStaticUrl}
                        disabled={$.loading}
                    >
                        Download via Static URL
                    </button>
                </div>

                {($.downloadResults.fileTime || $.downloadResults.arrayBufferTime || $.downloadResults.staticUrlTime) && (
                    <div className="result">
                        <h4>📊 Download Performance Comparison:</h4>
                        <table style={{width: '100%', borderCollapse: 'collapse', marginTop: '10px'}}>
                            <thead>
                                <tr style={{backgroundColor: '#f0f0f0'}}>
                                    <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'left'}}>Method</th>
                                    <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'right'}}>Time</th>
                                    <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'right'}}>Throughput</th>
                                    <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'center'}}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {$.downloadResults.fileTime !== undefined && (
                                    <tr>
                                        <td style={{padding: '8px', border: '1px solid #ddd'}}>File (RPC)</td>
                                        <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'right'}}>
                                            {$.downloadResults.fileTime.toFixed(2)} ms
                                        </td>
                                        <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'right'}}>
                                            {(($.downloadResults.fileSize || 0) / 1024 / 1024 / ($.downloadResults.fileTime / 1000)).toFixed(2)} MB/s
                                        </td>
                                        <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'center'}}>
                                            {(() => {
                                                const times = [$.downloadResults.fileTime, $.downloadResults.arrayBufferTime, $.downloadResults.staticUrlTime].filter(t => t !== undefined) as number[];
                                                const minTime = Math.min(...times);
                                                return $.downloadResults.fileTime === minTime ? '🏆 Fastest' : '✅';
                                            })()}
                                        </td>
                                    </tr>
                                )}
                                {$.downloadResults.arrayBufferTime !== undefined && (
                                    <tr>
                                        <td style={{padding: '8px', border: '1px solid #ddd'}}>ArrayBuffer (RPC)</td>
                                        <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'right'}}>
                                            {$.downloadResults.arrayBufferTime.toFixed(2)} ms
                                        </td>
                                        <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'right'}}>
                                            {(($.downloadResults.fileSize || 0) / 1024 / 1024 / ($.downloadResults.arrayBufferTime / 1000)).toFixed(2)} MB/s
                                        </td>
                                        <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'center'}}>
                                            {(() => {
                                                const times = [$.downloadResults.fileTime, $.downloadResults.arrayBufferTime, $.downloadResults.staticUrlTime].filter(t => t !== undefined) as number[];
                                                const minTime = Math.min(...times);
                                                return $.downloadResults.arrayBufferTime === minTime ? '🏆 Fastest' : '✅';
                                            })()}
                                        </td>
                                    </tr>
                                )}
                                {$.downloadResults.staticUrlTime !== undefined && (
                                    <tr>
                                        <td style={{padding: '8px', border: '1px solid #ddd'}}>Static URL</td>
                                        <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'right'}}>
                                            {$.downloadResults.staticUrlTime.toFixed(2)} ms
                                        </td>
                                        <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'right'}}>
                                            {(($.downloadResults.fileSize || 0) / 1024 / 1024 / ($.downloadResults.staticUrlTime / 1000)).toFixed(2)} MB/s
                                        </td>
                                        <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'center'}}>
                                            {(() => {
                                                const times = [$.downloadResults.fileTime, $.downloadResults.arrayBufferTime, $.downloadResults.staticUrlTime].filter(t => t !== undefined) as number[];
                                                const minTime = Math.min(...times);
                                                return $.downloadResults.staticUrlTime === minTime ? '🏆 Fastest' : '✅';
                                            })()}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        {$.downloadResults.fileSize && (
                            <p style={{marginTop: '10px'}}>
                                <small>File size: {($.downloadResults.fileSize / (1024 * 1024)).toFixed(2)} MB ({$.downloadResults.fileSize.toLocaleString()} bytes)</small>
                            </p>
                        )}
                    </div>
                )}

                {$.downloadResults.fileUrl && (
                    <div className="result">
                        <h4>📥 Downloaded as File:</h4>
                        <img 
                            src={$.downloadResults.fileUrl} 
                            alt="Downloaded as File" 
                            style={{maxWidth: '300px', border: '2px solid #2196F3', borderRadius: '8px'}}
                        />
                    </div>
                )}

                {$.downloadResults.arrayBufferUrl && (
                    <div className="result">
                        <h4>📥 Downloaded as ArrayBuffer:</h4>
                        <img 
                            src={$.downloadResults.arrayBufferUrl} 
                            alt="Downloaded as ArrayBuffer" 
                            style={{maxWidth: '300px', border: '2px solid #FF9800', borderRadius: '8px'}}
                        />
                    </div>
                )}

                {$.downloadResults.staticUrl && (
                    <div className="result">
                        <h4>📥 Downloaded via Static URL:</h4>
                        <img 
                            src={$.downloadResults.staticUrl} 
                            alt="Downloaded via Static URL" 
                            style={{maxWidth: '300px', border: '2px solid #4CAF50', borderRadius: '8px'}}
                        />
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>🔒 Admin-Only Method</h3>
                <div className="button-group">
                    <button
                        onClick={testAdminSecret}
                        disabled={!$.canInteract}
                    >
                        Get Admin Secret
                    </button>
                </div>

                {$.results.adminSecret && (
                    <div className="result">
                        <h4>🔐 Admin Secret:</h4>
                        <pre>{JSON.stringify($.results.adminSecret, null, 2)}</pre>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>🎵 Audio Download & Playback (HTML5)</h3>
                <div className="button-group" style={{alignItems: 'center', gap: '10px'}}>
                    <button
                        onClick={downloadAudio}
                        disabled={!$.canInteract}
                    >
                        Download Audio
                    </button>
                    <label style={{display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer'}}>
                        <input
                            type="checkbox"
                            checked={$.autoPlayAudio}
                            onChange={(e) => $.autoPlayAudio = e.target.checked}
                            style={{cursor: 'pointer'}}
                        />
                        Auto Play
                    </label>
                </div>

                {$.downloadResults.audioUrl && (
                    <div className="result">
                        <audio 
                            controls 
                            autoPlay={$.autoPlayAudio}
                            src={$.downloadResults.audioUrl}
                            style={{width: '100%'}}
                            onPlay={() => {
                                // When HTML5 audio plays, stop other players
                                if (msePlayer) {
                                    msePlayer.cleanup();
                                    msePlayer = undefined;
                                    $.webAudio.isPlaying = false;
                                    $.webAudio.isPaused = false;
                                }
                                if (streamingPlayer) {
                                    streamingPlayer.cleanup();
                                    streamingPlayer = undefined;
                                    $.streamingAudio.isPlaying = false;
                                    $.streamingAudio.isPaused = false;
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
                        disabled={!$.canInteract}
                    >
                        Download and Play
                    </button>
                    <button
                        onClick={playWebAudio}
                        disabled={!$.webAudio.duration || $.webAudio.isPlaying}
                    >
                        ▶️ Play
                    </button>
                    <button
                        onClick={pauseWebAudio}
                        disabled={!$.webAudio.isPlaying}
                    >
                        ⏸️ Pause
                    </button>
                    <button
                        onClick={stopWebAudio}
                        disabled={!$.webAudio.isPlaying && !$.webAudio.isPaused}
                    >
                        ⏹️ Stop
                    </button>
                </div>

                {$.webAudio.duration && (
                    <div className="result">
                        <p><strong>Duration:</strong> {$.webAudio.duration.toFixed(2)}s | <strong>State:</strong> {
                            $.webAudio.isPlaying ? '▶️ Playing' :
                            $.webAudio.isPaused ? '⏸️ Paused' :
                            '⏹️ Stopped'
                        }</p>
                        <p><small>Sample rate: {$.webAudio.sampleRate}Hz | Channels: {$.webAudio.channels}</small></p>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>🌊 Progressive Streaming Audio (ReadableStream)</h3>
                <p><small>Server returns a pure ReadableStream that streams chunks over the network progressively</small></p>
                <div className="button-group">
                    <button
                        onClick={streamAndPlayAudio}
                        disabled={!$.canInteract}
                    >
                        🎵 Stream & Play
                    </button>
                    <button
                        onClick={playStreamingAudio}
                        disabled={!$.streamingAudio.duration || $.streamingAudio.isPlaying}
                    >
                        ▶️ Play
                    </button>
                    <button
                        onClick={pauseStreamingAudio}
                        disabled={!$.streamingAudio.isPlaying}
                    >
                        ⏸️ Pause
                    </button>
                    <button
                        onClick={stopStreamingAudio}
                        disabled={!$.streamingAudio.isPlaying && !$.streamingAudio.isPaused}
                    >
                        ⏹️ Stop
                    </button>
                </div>

                {($.streamingAudio.isStreaming || $.streamingAudio.bytesReceived > 0) && (
                    <div className="result">
                        <h4>📊 Streaming Progress:</h4>
                        <p>
                            <strong>Bytes Received:</strong> {($.streamingAudio.bytesReceived / 1024 / 1024).toFixed(2)} MB
                            {$.streamingAudio.isStreaming && <span> 🔄 (streaming...)</span>}
                        </p>
                        {$.streamingAudio.duration && (
                            <p>
                                <strong>Duration:</strong> {$.streamingAudio.duration.toFixed(2)}s | 
                                <strong> State:</strong> {
                                    $.streamingAudio.isPlaying ? ' ▶️ Playing' :
                                    $.streamingAudio.isPaused ? ' ⏸️ Paused' :
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

            {$.loading && (
                <div className="loading">
                    <p>⏳ Loading...</p>
                </div>
            )}
        </div>
    );
}
