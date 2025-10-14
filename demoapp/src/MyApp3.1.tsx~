import { PotoClient } from "poto";
import { Constants, ServerInfo, GenData, ImageSize } from "./demoConsts";
import type { DemoModule } from "./DemoModule";
import { makeState } from "./ReactiveState";



export function MyApp3({
    host = 'http://localhost' as string, port = Constants.port as number
}) {
    const SessionData = "stored in seesion";

    // Store Web Audio API objects outside reactive state to avoid proxy issues
    let webAudioContext: AudioContext | undefined;
    let webAudioSource: AudioBufferSourceNode | undefined;
    let webAudioBuffer: AudioBuffer | undefined;

    // Clean API - Pure TypeScript initialization with lazy initialization!
    const $ = makeState(() => {
        const potoClient = new PotoClient(`${host}:${port}`);
        const module = potoClient.getProxy<DemoModule>(Constants.serverModuleName);

        console.log('✅ Poto client initialized');

        return {
            state: {
                client: potoClient,
                demoModule: module,
                isConnected: true,
                currentUser: '',
                loading: false,
                results: {
                    greeting: undefined as string | undefined,
                    echo: undefined as string | undefined,
                    serverInfo: undefined as ServerInfo | undefined,
                    streamData: undefined as GenData[] | undefined,
                    imageSize: undefined as ImageSize | undefined,
                    adminSecret: undefined as any,
                    error: undefined as string | undefined,
                    uploadTiming: undefined as { totalTime: number; rpcTime: number; fileSize: number } | undefined,
                },
                downloadResults: {
                    fileUrl: undefined as string | undefined,
                    audioUrl: undefined as string | undefined,
                    arrayBufferUrl: undefined as string | undefined,
                    fileTime: undefined as number | undefined,
                    fileSize: undefined as number | undefined,
                    arrayBufferTime: undefined as number | undefined,
                    audioTime: undefined as number | undefined,
                    audioSize: undefined as number | undefined,
                },
                messageInput: 'Hello from the frontend!',
                selectedFile: null as File | null,
                autoPlayAudio: true,
                webAudio: {
                    isPlaying: false,
                    isPaused: false,
                    downloadTime: undefined as number | undefined,
                    fileSize: undefined as number | undefined,
                    duration: undefined as number | undefined,
                    sampleRate: undefined as number | undefined,
                    channels: undefined as number | undefined,
                    startTime: 0,
                    pauseTime: 0,
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

        const streamData: GenData[] = [];

        try {
            const stream = await $.demoModule.testStream(3);
            for await (const item of stream) {
                streamData.push(item);
                // Direct assignment - UI updates in real-time!
                $.results.streamData = [...streamData];
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
            console.error('Failed to get image size file:', error);
            $.results.error = `Failed to get image size file: ${error}`;
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

    const clearResults = () => {
        // Clean up image URLs to prevent memory leaks
        if ($.downloadResults.fileUrl) {
            URL.revokeObjectURL($.downloadResults.fileUrl);
        }
        if ($.downloadResults.arrayBufferUrl) {
            URL.revokeObjectURL($.downloadResults.arrayBufferUrl);
        }
        if ($.downloadResults.audioUrl) {
            URL.revokeObjectURL($.downloadResults.audioUrl);
        }
        
        // Clean up Web Audio API resources
        if (webAudioSource) {
            try {
                webAudioSource.stop();
                webAudioSource.disconnect();
            } catch (e) {
                // Source might already be stopped
            }
            webAudioSource = undefined;
        }
        if (webAudioContext) {
            webAudioContext.close();
            webAudioContext = undefined;
        }
        webAudioBuffer = undefined;
        
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
            fileTime: undefined,
            fileSize: undefined,
            arrayBufferTime: undefined,
            audioTime: undefined,
            audioSize: undefined,
        };
        
        $.webAudio = {
            isPlaying: false,
            isPaused: false,
            downloadTime: undefined,
            fileSize: undefined,
            duration: undefined,
            sampleRate: undefined,
            channels: undefined,
            startTime: 0,
            pauseTime: 0,
        };
        
        webAudioContext = undefined;
        webAudioSource = undefined;
        webAudioBuffer = undefined;
    };

    const downloadAsFile = async () => {
        if (!$.demoModule) return;
        
        $.loading = true;
        try {
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🔵 CLIENT: File/Blob Download - Decoding Strategy');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            const startTime = performance.now();
            const file = await $.demoModule.downloadImageAsFile();
            const downloadTime = performance.now() - startTime;
            
            // Create object URL for display
            const fileUrl = URL.createObjectURL(file);
            
            $.downloadResults.fileUrl = fileUrl;
            $.downloadResults.fileTime = downloadTime;
            $.downloadResults.fileSize = file.size;
            $.results.error = undefined;
            
            console.log('\n📥 CLIENT DECODING STRATEGY (Blob):');
            console.log('  1️⃣ Server sends: { __blob: { data: base64, type, size, name, lastModified } }');
            console.log('  2️⃣ TypedJSON.parse() detects __blob marker');
            console.log('  3️⃣ Native atob() decodes base64 → binary string (FAST!)');
            console.log('  4️⃣ Binary string → Uint8Array → new Blob()');
            console.log('  5️⃣ Result: Full Blob/File object reconstructed with metadata');
            
            console.log(`\n⏱️ downloadAsFile (File) Performance:`);
            console.log(`  - File size: ${(file.size / (1024 * 1024)).toFixed(2)} MB (${file.size.toLocaleString()} bytes)`);
            console.log(`  - Download time: ${downloadTime.toFixed(2)}ms`);
            console.log(`  - Throughput: ${(file.size / 1024 / 1024 / (downloadTime / 1000)).toFixed(2)} MB/s`);
            console.log(`  - File type: ${file.type}`);
        } catch (error) {
            console.error('❌ Download as File failed:', error);
            $.results.error = `Download as File failed: ${error}`;
        } finally {
            $.loading = false;
        }
    };

    const downloadAsArrayBuffer = async () => {
        if (!$.demoModule) return;
        
        $.loading = true;
        try {
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🔵 CLIENT: ArrayBuffer Download - Decoding Strategy');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            const startTime = performance.now();
            const arrayBuffer = await $.demoModule.downloadImageAsArrayBuffer();
            const downloadTime = performance.now() - startTime;
            
            // Create object URL for display
            const blob = new Blob([arrayBuffer], { type: 'image/png' });
            const arrayBufferUrl = URL.createObjectURL(blob);
            
            $.downloadResults.arrayBufferUrl = arrayBufferUrl;
            $.downloadResults.arrayBufferTime = downloadTime;
            $.downloadResults.fileSize = arrayBuffer.byteLength;
            $.results.error = undefined;
            
            console.log('\n📥 CLIENT DECODING STRATEGY (ArrayBuffer):');
            console.log('  1️⃣ Server sends: { __arraybuffer: base64String }');
            console.log('  2️⃣ TypedJSON.parse() detects __arraybuffer marker');
            console.log('  3️⃣ Native atob() decodes base64 → binary string (FAST!)');
            console.log('  4️⃣ Binary string → Uint8Array → ArrayBuffer extracted');
            console.log('  5️⃣ Result: Pure ArrayBuffer (no metadata)');
            
            console.log(`\n⏱️ downloadAsArrayBuffer (ArrayBuffer) Performance:`);
            console.log(`  - File size: ${(arrayBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB (${arrayBuffer.byteLength.toLocaleString()} bytes)`);
            console.log(`  - Download time: ${downloadTime.toFixed(2)}ms`);
            console.log(`  - Throughput: ${(arrayBuffer.byteLength / 1024 / 1024 / (downloadTime / 1000)).toFixed(2)} MB/s`);
            console.log(`  - Data type: ArrayBuffer`);
        } catch (error) {
            console.error('❌ Download as ArrayBuffer failed:', error);
            $.results.error = `Download as ArrayBuffer failed: ${error}`;
        } finally {
            $.loading = false;
        }
    };

    const downloadAudio = async () => {
        if (!$.demoModule) return;
        
        $.loading = true;
        try {
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🔵 CLIENT: Audio File Download - Decoding Strategy');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            const startTime = performance.now();
            const audioBlob = await $.demoModule.downloadAudioFile();
            const downloadTime = performance.now() - startTime;
            
            // Create object URL for audio playback
            const audioUrl = URL.createObjectURL(audioBlob);
            
            $.downloadResults.audioUrl = audioUrl;
            $.downloadResults.audioTime = downloadTime;
            $.downloadResults.audioSize = audioBlob.size;
            $.results.error = undefined;
            
            console.log('\n📥 CLIENT DECODING STRATEGY (Audio Blob):');
            console.log('  1️⃣ Server sends: { __blob: { data: base64, type, size, name, lastModified } }');
            console.log('  2️⃣ TypedJSON.parse() detects __blob marker');
            console.log('  3️⃣ Native atob() decodes base64 → binary string (FAST!)');
            console.log('  4️⃣ Binary string → Uint8Array → new Blob()');
            console.log('  5️⃣ Result: Full Blob object reconstructed with metadata');
            console.log(`  🎵 Audio ready for playback${$.autoPlayAudio ? ' - auto-playing!' : '!'}`);
            
            console.log(`\n⏱️ downloadAudio (Audio Blob) Performance:`);
            console.log(`  - File size: ${(audioBlob.size / (1024 * 1024)).toFixed(2)} MB (${audioBlob.size.toLocaleString()} bytes)`);
            console.log(`  - Download time: ${downloadTime.toFixed(2)}ms`);
            console.log(`  - Throughput: ${(audioBlob.size / 1024 / 1024 / (downloadTime / 1000)).toFixed(2)} MB/s`);
            console.log(`  - Audio type: ${audioBlob.type}`);
            console.log(`  - 🎶 Auto-play: ${$.autoPlayAudio ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('❌ Download audio failed:', error);
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
        
        $.loading = true;
        try {
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🔵 CLIENT: Web Audio API - Download & Decode Strategy');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            const startTime = performance.now();
            const audioBlob = await $.demoModule.downloadAudioFile();
            const downloadTime = performance.now() - startTime;
            
            console.log('\n📥 CLIENT DECODING STRATEGY (Web Audio API):');
            console.log('  1️⃣ Download: TypedJSON → Blob (same as before)');
            console.log('  2️⃣ Blob → ArrayBuffer: await blob.arrayBuffer()');
            console.log('  3️⃣ Create AudioContext: new AudioContext()');
            console.log('  4️⃣ Decode audio: await audioContext.decodeAudioData(arrayBuffer)');
            console.log('  5️⃣ Result: AudioBuffer ready for Web Audio API playback!');
            console.log('  🎵 Full programmatic control over audio!');
            
            // Convert Blob to ArrayBuffer
            const arrayBuffer = await audioBlob.arrayBuffer();
            
            // Create or reuse AudioContext (stored outside reactive state)
            if (!webAudioContext || webAudioContext.state === 'closed') {
                webAudioContext = new AudioContext();
                console.log('🎵 DEBUG: Created new AudioContext');
                console.log('🎵 DEBUG: Type:', typeof webAudioContext);
                console.log('🎵 DEBUG: Constructor:', webAudioContext.constructor.name);
                console.log('🎵 DEBUG: instanceof AudioContext:', webAudioContext instanceof AudioContext);
                console.log('🎵 DEBUG: Has suspend method:', typeof webAudioContext.suspend === 'function');
            }
            
            // Decode audio data
            webAudioBuffer = await webAudioContext.decodeAudioData(arrayBuffer);
            
            $.webAudio.downloadTime = downloadTime;
            $.webAudio.fileSize = audioBlob.size;
            $.webAudio.duration = webAudioBuffer.duration;
            $.webAudio.sampleRate = webAudioBuffer.sampleRate;
            $.webAudio.channels = webAudioBuffer.numberOfChannels;
            $.results.error = undefined;
            
            console.log(`\n⏱️ Web Audio API Performance:`);
            console.log(`  - File size: ${(audioBlob.size / (1024 * 1024)).toFixed(2)} MB (${audioBlob.size.toLocaleString()} bytes)`);
            console.log(`  - Download time: ${downloadTime.toFixed(2)}ms`);
            console.log(`  - Throughput: ${(audioBlob.size / 1024 / 1024 / (downloadTime / 1000)).toFixed(2)} MB/s`);
            console.log(`  - Audio duration: ${webAudioBuffer.duration.toFixed(2)}s`);
            console.log(`  - Sample rate: ${webAudioBuffer.sampleRate}Hz`);
            console.log(`  - Channels: ${webAudioBuffer.numberOfChannels}`);
            console.log(`  - 🎵 Auto-playing immediately!`);
            
            // Auto-play immediately after setup
            webAudioSource = webAudioContext.createBufferSource();
            webAudioSource.buffer = webAudioBuffer;
            webAudioSource.connect(webAudioContext.destination);
            webAudioSource.start(0);
            
            $.webAudio.isPlaying = true;
            $.webAudio.isPaused = false;
            $.webAudio.startTime = webAudioContext.currentTime;
            
            // Handle end of playback
            webAudioSource.onended = () => {
                $.webAudio.isPlaying = false;
                $.webAudio.isPaused = false;
                $.webAudio.pauseTime = 0;
            };
            
            console.log('▶️ Web Audio API: Auto-playing');
        } catch (error) {
            console.error('❌ Web Audio API setup failed:', error);
            $.results.error = `Web Audio API setup failed: ${error}`;
        } finally {
            $.loading = false;
        }
    };

    const playWebAudio = async () => {
        if (!webAudioBuffer || !webAudioContext) return;
        
        try {
            // If paused, just resume the audio context
            if ($.webAudio.isPaused && webAudioContext.state === 'suspended') {
                console.log('▶️ Resuming AudioContext, state:', webAudioContext.state);
                await webAudioContext.resume();
                $.webAudio.isPlaying = true;
                $.webAudio.isPaused = false;
                console.log('▶️ Web Audio API: Resumed');
                return;
            }
            
            // Stop any existing source
            if (webAudioSource) {
                try {
                    webAudioSource.stop();
                    webAudioSource.disconnect();
                } catch (e) {
                    // Already stopped
                }
            }
            
            // Create new source
            webAudioSource = webAudioContext.createBufferSource();
            webAudioSource.buffer = webAudioBuffer;
            webAudioSource.connect(webAudioContext.destination);
            
            // Start playback from beginning
            webAudioSource.start(0);
            
            $.webAudio.isPlaying = true;
            $.webAudio.isPaused = false;
            $.webAudio.startTime = webAudioContext.currentTime;
            
            // Handle end of playback
            webAudioSource.onended = () => {
                if ($.webAudio.isPlaying) {
                    $.webAudio.isPlaying = false;
                    $.webAudio.isPaused = false;
                    console.log('🎵 Playback ended naturally');
                }
            };
            
            console.log('▶️ Web Audio API: Playing from start');
        } catch (error) {
            console.error('❌ Web Audio playback failed:', error);
            $.results.error = `Web Audio playback failed: ${error}`;
        }
    };

    const pauseWebAudio = async () => {
        if (!$.webAudio.isPlaying || !webAudioContext) return;
        
        try {
            console.log('⏸️ DEBUG: Attempting to pause');
            console.log('⏸️ DEBUG: webAudioContext exists?', !!webAudioContext);
            console.log('⏸️ DEBUG: webAudioContext type:', typeof webAudioContext);
            console.log('⏸️ DEBUG: webAudioContext constructor:', webAudioContext?.constructor?.name);
            console.log('⏸️ DEBUG: webAudioContext instanceof AudioContext:', webAudioContext instanceof AudioContext);
            console.log('⏸️ DEBUG: webAudioContext.state:', webAudioContext.state);
            console.log('⏸️ DEBUG: webAudioContext.suspend is function?', typeof webAudioContext.suspend === 'function');
            console.log('⏸️ DEBUG: AudioContext available?', typeof AudioContext !== 'undefined');
            
            // Use audioContext.suspend() - the proper way to pause
            await webAudioContext.suspend();
            
            $.webAudio.isPlaying = false;
            $.webAudio.isPaused = true;
            
            console.log('✅ Web Audio API: Successfully paused (context suspended)');
        } catch (error: any) {
            console.error('❌ Web Audio pause failed:', error);
            console.error('❌ Error details:', {
                message: error?.message,
                stack: error?.stack,
                audioContextState: webAudioContext?.state
            });
            $.results.error = `Web Audio pause failed: ${error}`;
        }
    };

    const stopWebAudio = () => {
        if (!webAudioSource || !webAudioContext) return;
        
        try {
            // Resume context if suspended, then stop
            if (webAudioContext.state === 'suspended') {
                webAudioContext.resume();
            }
            
            // Stop the source
            try {
                webAudioSource.stop();
                webAudioSource.disconnect();
            } catch (stopError) {
                // Source already stopped - OK
            }
            
            $.webAudio.isPlaying = false;
            $.webAudio.isPaused = false;
            $.webAudio.pauseTime = 0;
            $.webAudio.startTime = 0;
            
            console.log('⏹️ Web Audio API: Stopped');
        } catch (error) {
            console.error('❌ Web Audio stop failed:', error);
            // Reset state on error
            $.webAudio.isPlaying = false;
            $.webAudio.isPaused = false;
            $.webAudio.pauseTime = 0;
        }
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
                        disabled={$.loading || !$.isConnected || !$.currentUser}
                    >
                        Get Greeting
                    </button>
                    <button
                        onClick={getServerInfo}
                        disabled={$.loading || !$.isConnected || !$.currentUser}
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
                        disabled={$.loading || !$.isConnected || !$.currentUser} />
                    <button
                        onClick={sendMessage}
                        disabled={$.loading || !$.isConnected || !$.currentUser}
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
                        disabled={$.loading || !$.isConnected || !$.currentUser}
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
                        disabled={$.loading || !$.isConnected || !$.currentUser} />
                    <button
                        onClick={getImageSize}
                        disabled={$.loading || !$.isConnected || !$.currentUser || !$.selectedFile}
                    >
                        Upload (Uint8Array)
                    </button>
                    <button
                        onClick={getImageSizeArrayBuffer}
                        disabled={$.loading || !$.isConnected || !$.currentUser || !$.selectedFile}
                    >
                        Upload (ArrayBuffer)
                    </button>
                    <button
                        onClick={getImageSizeDirectFile}
                        disabled={$.loading || !$.isConnected || !$.currentUser || !$.selectedFile}
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
                <p><small>Download logo.jpg (6.8 MB) from server as different binary types</small></p>
                <div className="button-group">
                    <button
                        onClick={downloadAsFile}
                        disabled={$.loading || !$.isConnected || !$.currentUser}
                    >
                        Download as File
                    </button>
                    <button
                        onClick={downloadAsArrayBuffer}
                        disabled={$.loading || !$.isConnected || !$.currentUser}
                    >
                        Download as ArrayBuffer
                    </button>
                </div>

                {($.downloadResults.fileTime || $.downloadResults.arrayBufferTime) && (
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
                                {$.downloadResults.fileTime && (
                                    <tr>
                                        <td style={{padding: '8px', border: '1px solid #ddd'}}>File</td>
                                        <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'right'}}>
                                            {$.downloadResults.fileTime.toFixed(2)} ms
                                        </td>
                                        <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'right'}}>
                                            {(($.downloadResults.fileSize || 0) / 1024 / 1024 / ($.downloadResults.fileTime / 1000)).toFixed(2)} MB/s
                                        </td>
                                        <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'center'}}>
                                            {$.downloadResults.fileTime < ($.downloadResults.arrayBufferTime || Infinity) ? '🏆 Faster' : '✅'}
                                        </td>
                                    </tr>
                                )}
                                {$.downloadResults.arrayBufferTime && (
                                    <tr>
                                        <td style={{padding: '8px', border: '1px solid #ddd'}}>ArrayBuffer</td>
                                        <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'right'}}>
                                            {$.downloadResults.arrayBufferTime.toFixed(2)} ms
                                        </td>
                                        <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'right'}}>
                                            {(($.downloadResults.fileSize || 0) / 1024 / 1024 / ($.downloadResults.arrayBufferTime / 1000)).toFixed(2)} MB/s
                                        </td>
                                        <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'center'}}>
                                            {$.downloadResults.arrayBufferTime < ($.downloadResults.fileTime || Infinity) ? '🏆 Faster' : '✅'}
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
            </div>

            <div className="demo-section">
                <h3>🔒 Admin-Only Method</h3>
                <div className="button-group">
                    <button
                        onClick={testAdminSecret}
                        disabled={$.loading || !$.isConnected || !$.currentUser}
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
                <h3>🎵 Audio Download & Playback</h3>
                <p><small>Download and play Caliente.mp3 from server</small></p>
                <div className="button-group" style={{alignItems: 'center', gap: '10px'}}>
                    <button
                        onClick={downloadAudio}
                        disabled={$.loading || !$.isConnected || !$.currentUser}
                    >
                        Download Audio File
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

                {$.downloadResults.audioTime && (
                    <div className="result">
                        <h4>📊 Audio Download Performance:</h4>
                        <p>• File size: {(($.downloadResults.audioSize || 0) / (1024 * 1024)).toFixed(2)} MB ({($.downloadResults.audioSize || 0).toLocaleString()} bytes)</p>
                        <p>• Download time: {$.downloadResults.audioTime.toFixed(2)} ms</p>
                        <p>• Throughput: {((($.downloadResults.audioSize || 0) / 1024 / 1024) / ($.downloadResults.audioTime / 1000)).toFixed(2)} MB/s</p>
                    </div>
                )}

                {$.downloadResults.audioUrl && (
                    <div className="result">
                        <h4>🎧 Audio Player:</h4>
                        <audio 
                            controls 
                            autoPlay={$.autoPlayAudio}
                            src={$.downloadResults.audioUrl}
                            style={{width: '100%', marginTop: '10px'}}
                        />
                        <p style={{marginTop: '10px'}}>
                            <small>{$.autoPlayAudio ? '🎶 Audio auto-playing!' : '▶️ Click play to start audio.'} Use controls to pause/adjust volume.</small>
                        </p>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>🎛️ Web Audio API Playback</h3>
                <p><small>Download and play using Web Audio API (no HTML5 player)</small></p>
                <div className="button-group">
                    <button
                        onClick={downloadAndPlayWithWebAudio}
                        disabled={$.loading || !$.isConnected || !$.currentUser}
                    >
                        Download & Setup Web Audio
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

                {$.webAudio.downloadTime && (
                    <div className="result">
                        <h4>📊 Web Audio API Performance:</h4>
                        <p>• File size: {(($.webAudio.fileSize || 0) / (1024 * 1024)).toFixed(2)} MB ({($.webAudio.fileSize || 0).toLocaleString()} bytes)</p>
                        <p>• Download time: {$.webAudio.downloadTime.toFixed(2)} ms</p>
                        <p>• Throughput: {((($.webAudio.fileSize || 0) / 1024 / 1024) / ($.webAudio.downloadTime / 1000)).toFixed(2)} MB/s</p>
                        {$.webAudio.duration && (
                            <>
                                <p>• Duration: {$.webAudio.duration.toFixed(2)} seconds</p>
                                <p>• Sample rate: {$.webAudio.sampleRate}Hz</p>
                                <p>• Channels: {$.webAudio.channels}</p>
                            </>
                        )}
                    </div>
                )}

                {$.webAudio.duration && (
                    <div className="result">
                        <h4>🎛️ Web Audio API Status:</h4>
                        <p>
                            <strong>State:</strong> {
                                $.webAudio.isPlaying ? '▶️ Playing' :
                                $.webAudio.isPaused ? '⏸️ Paused' :
                                '⏹️ Stopped'
                            }
                        </p>
                        <p><small>✨ Full programmatic control! No HTML5 audio element used.</small></p>
                        <p><small>💡 Web Audio API provides low-level audio processing capabilities.</small></p>
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
