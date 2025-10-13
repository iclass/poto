import { PotoClient } from "poto";
import { Constants, ServerInfo, GenData, ImageSize } from "./demoConsts";
import type { DemoModule } from "./DemoModule";
import { makeState } from "./ReactiveState";

// Store Web Audio API objects at module level to persist across renders
let webAudioContext: AudioContext | undefined;
let webAudioSource: AudioBufferSourceNode | undefined;
let webAudioBuffer: AudioBuffer | undefined;

export function MyApp3({
    host = 'http://localhost' as string, port = Constants.port as number
}) {
    const SessionData = "stored in seesion";

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
                },
                downloadResults: {
                    fileUrl: undefined as string | undefined,
                    audioUrl: undefined as string | undefined,
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
        try {
            const arrayBuffer = await $.selectedFile.arrayBuffer();
            const imageBuffer = new Uint8Array(arrayBuffer);
            const imageSize = await $.demoModule.getImageSize(imageBuffer);
            
            $.results.imageSize = imageSize;
            $.results.error = undefined;
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
        try {
            const arrayBuffer = await $.selectedFile.arrayBuffer();
            const imageSize = await $.demoModule.getImageSizeArrayBuffer(arrayBuffer);
            
            $.results.imageSize = imageSize;
            $.results.error = undefined;
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
        try {
            const imageSize = await $.demoModule.getImageSizeFile($.selectedFile);
            $.results.imageSize = imageSize;
            $.results.error = undefined;
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

    const clearResults = () => {
        // Clean up URLs to prevent memory leaks
        if ($.downloadResults.fileUrl) {
            URL.revokeObjectURL($.downloadResults.fileUrl);
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
        };
        
        $.downloadResults = {
            fileUrl: undefined,
            audioUrl: undefined,
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
        
        webAudioContext = undefined;
        webAudioSource = undefined;
        webAudioBuffer = undefined;
    };

    const downloadAsFile = async () => {
        if (!$.demoModule) return;
        
        $.loading = true;
        try {
            const file = await $.demoModule.downloadImageAsFile();
            const fileUrl = URL.createObjectURL(file);
            
            $.downloadResults.fileUrl = fileUrl;
            $.results.error = undefined;
        } catch (error) {
            console.error('Download as File failed:', error);
            $.results.error = `Download as File failed: ${error}`;
        } finally {
            $.loading = false;
        }
    };


    const downloadAudio = async () => {
        if (!$.demoModule) return;
        
        // Stop any existing Web Audio API playback first
        if (webAudioSource) {
            try {
                webAudioSource.stop();
                webAudioSource.disconnect();
            } catch (e) {
                // Already stopped
            }
            webAudioSource = undefined;
        }
        if (webAudioContext && webAudioContext.state === 'suspended') {
            await webAudioContext.resume();
        }
        $.webAudio.isPlaying = false;
        $.webAudio.isPaused = false;
        
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
        
        // Stop HTML5 audio player if it's playing
        const audioElement = document.querySelector('audio');
        if (audioElement) {
            audioElement.pause();
            audioElement.currentTime = 0;
        }
        
        // Stop any existing Web Audio API playback
        if (webAudioSource) {
            try {
                webAudioSource.stop();
                webAudioSource.disconnect();
            } catch (e) {
                // Already stopped
            }
            webAudioSource = undefined;
        }
        
        $.loading = true;
        try {
            const audioBlob = await $.demoModule.downloadAudioFile();
            const arrayBuffer = await audioBlob.arrayBuffer();
            
            // Create or reuse AudioContext (stored outside reactive state)
            if (!webAudioContext || webAudioContext.state === 'closed') {
                webAudioContext = new AudioContext();
            }
            
            // Resume context if it was suspended
            if (webAudioContext.state === 'suspended') {
                await webAudioContext.resume();
            }
            
            // Decode audio data (this is the slow part for large files)
            webAudioBuffer = await webAudioContext.decodeAudioData(arrayBuffer);
            
            $.webAudio.duration = webAudioBuffer.duration;
            $.webAudio.sampleRate = webAudioBuffer.sampleRate;
            $.webAudio.channels = webAudioBuffer.numberOfChannels;
            $.results.error = undefined;
            
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
                await webAudioContext.resume();
                $.webAudio.isPlaying = true;
                $.webAudio.isPaused = false;
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
                }
            };
        } catch (error) {
            console.error('❌ Web Audio playback failed:', error);
            $.results.error = `Web Audio playback failed: ${error}`;
        }
    };

    const pauseWebAudio = async () => {
        if (!$.webAudio.isPlaying || !webAudioContext) return;
        
        try {
            await webAudioContext.suspend();
            $.webAudio.isPlaying = false;
            $.webAudio.isPaused = true;
        } catch (error: any) {
            console.error('❌ Web Audio pause failed:', error);
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
                        <h4>📐 Image Size:</h4>
                        <p>Width: {$.results.imageSize.width}px | Height: {$.results.imageSize.height}px</p>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>⬇️ Image Download</h3>
                <div className="button-group">
                    <button
                        onClick={downloadAsFile}
                        disabled={$.loading || !$.isConnected || !$.currentUser}
                    >
                        Download Image
                    </button>
                </div>

                {$.downloadResults.fileUrl && (
                    <div className="result">
                        <h4>📥 Downloaded Image:</h4>
                        <img 
                            src={$.downloadResults.fileUrl} 
                            alt="Downloaded" 
                            style={{maxWidth: '300px', border: '2px solid #2196F3', borderRadius: '8px'}}
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
                <h3>🎵 Audio Download & Playback (HTML5)</h3>
                <div className="button-group" style={{alignItems: 'center', gap: '10px'}}>
                    <button
                        onClick={downloadAudio}
                        disabled={$.loading || !$.isConnected || !$.currentUser}
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
                        />
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>🎛️ Web Audio API Playback</h3>
                <div className="button-group">
                    <button
                        onClick={downloadAndPlayWithWebAudio}
                        disabled={$.loading || !$.isConnected || !$.currentUser}
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
