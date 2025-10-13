import { PotoClient } from "poto";
import { Constants, ServerInfo, GenData, ImageSize, ImageResponse } from "./demoConsts";
import type { DemoModule } from "./DemoModule";
import { makeState } from "./ReactiveState";



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
                    imageResponse: undefined as ImageResponse | undefined,
                    imageUrl: undefined as string | undefined,
                    adminSecret: undefined as any,
                    error: undefined as string | undefined,
                },
                messageInput: 'Hello from the frontend!',
                selectedFile: null as File | null,
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
            // Log file metadata
            console.log('📁 File Info:', {
                name: $.selectedFile.name,
                size: `${($.selectedFile.size / 1024 / 1024).toFixed(2)} MB`,
                type: $.selectedFile.type,
                lastModified: new Date($.selectedFile.lastModified).toISOString()
            });
            
            const startConversion = performance.now();
            const arrayBuffer = await $.selectedFile.arrayBuffer();
            const imageBuffer = new Uint8Array(arrayBuffer);
            const conversionTime = performance.now() - startConversion;
            
            const startRpc = performance.now();
            const imageResponse = await $.demoModule.getImageSize(imageBuffer);
            const rpcTime = performance.now() - startRpc;
            
            const totalTime = performance.now() - startTotal;
            
            // Verify type preservation and data integrity
            const receivedType = imageResponse.imageData.constructor.name;
            const dataMatches = imageResponse.imageData.length === imageBuffer.length;
            const typeMatches = receivedType === 'Uint8Array';
            
            console.log('⏱️ getImageSize (Uint8Array) Performance:');
            console.log(`  - File size: ${($.selectedFile.size / 1024 / 1024).toFixed(2)} MB (${$.selectedFile.size.toLocaleString()} bytes)`);
            console.log(`  - Client File→Uint8Array: ${conversionTime.toFixed(2)}ms`);
            console.log(`  - RPC round-trip time: ${rpcTime.toFixed(2)}ms`);
            console.log(`  - Total time: ${totalTime.toFixed(2)}ms`);
            console.log(`  - Throughput: ${(($.selectedFile.size / 1024 / 1024) / (totalTime / 1000)).toFixed(2)} MB/s`);
            console.log(`  - 🔄 Round-trip: Uint8Array → Server → ${receivedType} ${typeMatches ? '✅' : '❌'}`);
            console.log(`  - Type preserved: ${typeMatches ? '✅ YES!' : '❌ NO! Got ' + receivedType}`);
            console.log(`  - Data integrity: ${dataMatches ? '✅ Perfect match!' : '❌ Mismatch!'}`);
            console.log(`  - Server reported type: ${imageResponse.dataType}`);
            console.log(`  - ✨ Uses native encoding/decoding on both sides!`);
            
            // Create image URL from returned data
            const blob = new Blob([imageResponse.imageData], { type: 'image/png' } as any);
            const imageUrl = URL.createObjectURL(blob);
            
            $.results.imageSize = { width: imageResponse.width, height: imageResponse.height };
            $.results.imageResponse = imageResponse;
            $.results.imageUrl = imageUrl;
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
        const startTotal = performance.now();
        
        try {
            // Log file metadata
            console.log('📁 File Info:', {
                name: $.selectedFile.name,
                size: `${($.selectedFile.size / 1024 / 1024).toFixed(2)} MB`,
                type: $.selectedFile.type,
                lastModified: new Date($.selectedFile.lastModified).toISOString()
            });
            
            const startConversion = performance.now();
            const arrayBuffer = await $.selectedFile.arrayBuffer();
            const conversionTime = performance.now() - startConversion;
            
            const startRpc = performance.now();
            const imageResponse = await $.demoModule.getImageSizeArrayBuffer(arrayBuffer);
            const rpcTime = performance.now() - startRpc;
            
            const totalTime = performance.now() - startTotal;
            
            // Verify type preservation and data integrity
            const receivedType = imageResponse.imageData.constructor.name;
            const dataMatches = imageResponse.imageData.byteLength === arrayBuffer.byteLength;
            const typeMatches = receivedType === 'ArrayBuffer';
            
            console.log('⏱️ getImageSizeArrayBuffer (ArrayBuffer) Performance:');
            console.log(`  - File size: ${($.selectedFile.size / 1024 / 1024).toFixed(2)} MB (${$.selectedFile.size.toLocaleString()} bytes)`);
            console.log(`  - Client File→ArrayBuffer: ${conversionTime.toFixed(2)}ms`);
            console.log(`  - RPC round-trip time: ${rpcTime.toFixed(2)}ms`);
            console.log(`  - Total time: ${totalTime.toFixed(2)}ms`);
            console.log(`  - Throughput: ${(($.selectedFile.size / 1024 / 1024) / (totalTime / 1000)).toFixed(2)} MB/s`);
            console.log(`  - 🔄 Round-trip: ArrayBuffer → Server → ${receivedType} ${typeMatches ? '✅' : '❌'}`);
            console.log(`  - Type preserved: ${typeMatches ? '✅ YES!' : '❌ NO! Got ' + receivedType}`);
            console.log(`  - Data integrity: ${dataMatches ? '✅ Perfect match!' : '❌ Mismatch!'}`);
            console.log(`  - Server reported type: ${imageResponse.dataType}`);
            console.log(`  - ✨ Uses native encoding/decoding on both sides!`);
            
            // Create image URL from returned data
            const blob = new Blob([imageResponse.imageData], { type: 'image/png' } as any);
            const imageUrl = URL.createObjectURL(blob);
            
            $.results.imageSize = { width: imageResponse.width, height: imageResponse.height };
            $.results.imageResponse = imageResponse;
            $.results.imageUrl = imageUrl;
            $.results.error = undefined;
        } catch (error) {
            console.error('Failed to get image size array buffer:', error);
            $.results.error = `Failed to get image size array buffer: ${error}`;
        } finally {
            $.loading = false;
        }
    }

    const getImageSizeDirectFile = async () => {
        if (!$.demoModule || !$.selectedFile) return;

        $.loading = true;
        const startTotal = performance.now();
        
        try {
            // Log file metadata
            console.log('📁 File Info:', {
                name: $.selectedFile.name,
                size: `${($.selectedFile.size / 1024 / 1024).toFixed(2)} MB`,
                type: $.selectedFile.type,
                lastModified: new Date($.selectedFile.lastModified).toISOString()
            });
            
            const startRpc = performance.now();
            // Simplest syntax - just pass the File directly!
            const imageResponse = await $.demoModule.getImageSizeFile($.selectedFile);
            const rpcTime = performance.now() - startRpc;
            
            const totalTime = performance.now() - startTotal;
            
            // Verify type preservation and data integrity
            const receivedType = imageResponse.imageData.constructor.name;
            const dataMatches = imageResponse.imageData.size === $.selectedFile.size;
            const typeMatches = receivedType === 'File';
            const nameMatches = imageResponse.imageData.name === $.selectedFile.name;
            const typeStringMatches = imageResponse.imageData.type === $.selectedFile.type;
            
            console.log('⏱️ getImageSizeFile (File/Blob) Performance:');
            console.log(`  - File size: ${($.selectedFile.size / 1024 / 1024).toFixed(2)} MB (${$.selectedFile.size.toLocaleString()} bytes)`);
            console.log(`  - RPC round-trip time: ${rpcTime.toFixed(2)}ms`);
            console.log(`    (includes native FileReader base64 encoding + server processing)`);
            console.log(`  - Total time: ${totalTime.toFixed(2)}ms`);
            console.log(`  - Throughput: ${(($.selectedFile.size / 1024 / 1024) / (totalTime / 1000)).toFixed(2)} MB/s`);
            console.log(`  - 🔄 Round-trip: File → Server → ${receivedType} ${typeMatches ? '✅' : '❌'}`);
            console.log(`  - Type preserved: ${typeMatches ? '✅ YES!' : '❌ NO! Got ' + receivedType}`);
            console.log(`  - File name preserved: ${nameMatches ? '✅' : '❌'} (${imageResponse.imageData.name})`);
            console.log(`  - MIME type preserved: ${typeStringMatches ? '✅' : '❌'} (${imageResponse.imageData.type})`);
            console.log(`  - Data integrity: ${dataMatches ? '✅ Perfect match!' : '❌ Mismatch!'}`);
            console.log(`  - Server reported type: ${imageResponse.dataType}`);
            console.log(`  - ✨ Full File object preserved through RPC!`);
            
            // Create image URL from returned File
            const imageUrl = URL.createObjectURL(imageResponse.imageData);
            
            $.results.imageSize = { width: imageResponse.width, height: imageResponse.height };
            $.results.imageResponse = imageResponse;
            $.results.imageUrl = imageUrl;
            $.results.error = undefined;
        } catch (error) {
            console.error('Failed to get image size blob:', error);
            $.results.error = `Failed to get image size blob: ${error}`;
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
        // Clean up image URL to prevent memory leaks
        if ($.results.imageUrl) {
            URL.revokeObjectURL($.results.imageUrl);
        }
        
        $.results = {
            greeting: undefined,
            echo: undefined,
            serverInfo: undefined,
            streamData: undefined,
            imageSize: undefined,
            imageResponse: undefined,
            imageUrl: undefined,
            adminSecret: undefined,
            error: undefined,
        };
    };

    const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        $.messageInput = e.target.value;
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
                <h3>🖼️ Image Upload</h3>
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
                        Get Image Size (Uint8Array)
                    </button>
                    <button
                        onClick={getImageSizeArrayBuffer}
                        disabled={$.loading || !$.isConnected || !$.currentUser || !$.selectedFile}
                    >
                        Get Image Size (ArrayBuffer)
                    </button>
                    <button
                        onClick={getImageSizeDirectFile}
                        disabled={$.loading || !$.isConnected || !$.currentUser || !$.selectedFile}
                    >
                        Get Image Size (Blob) ✨
                    </button>
                </div>

                {$.results.imageSize && (
                    <div className="result">
                        <h4>📐 Image Size:</h4>
                        <p>Width: {$.results.imageSize.width}px | Height: {$.results.imageSize.height}px</p>
                        {$.results.imageResponse && (
                            <p><small>Original size: {($.results.imageResponse.originalSize / 1024 / 1024).toFixed(2)} MB | 
                            Type: {$.results.imageResponse.dataType}</small></p>
                        )}
                    </div>
                )}
                
                {$.results.imageUrl && (
                    <div className="result">
                        <h4>🔄 Round-Trip Image (Server Echo):</h4>
                        <p><small>This image was sent to server and returned back! ✅</small></p>
                        <img 
                            src={$.results.imageUrl} 
                            alt="Round-trip test" 
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
