import { PotoClient } from "poto";
import { Constants, ServerInfo, GenData, ImageSize } from "./demoConsts";
import type { DemoModule } from "./DemoModule";
import { makeState } from "./ReactiveState";
import { MyApp3Audio } from "./MyApp3Audio";

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
    // ═════════════════════════════════════════════════════════════════════════════
    // FLUENT BUILDER API - Initialize, setup cleanup, and watch in one chain!
    // ═════════════════════════════════════════════════════════════════════════════
    const $core = makeState(() => {
        const potoClient = new PotoClient(`${host}:${port}`);
        const savedUser = localStorage.getItem('myapp3:lastUser') || '';
        
        console.log('✅ Poto client initialized');
        if (savedUser) console.log('📂 Restored user:', savedUser);
        
        return {
            client: potoClient,
            demoModule: potoClient.getProxy(Constants.serverModuleName) as DemoModule,
            currentUser: savedUser,

            get isLoggedIn(): boolean {
                return !!$core.client?.userId && !!$core.client?.token;
            },
        };
    })
    .$onUnmount(() => {
        $core.client.unsubscribe();
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



    // ─────────────────────────────────────────────────────────────────────────────
    // UI STATE - Form inputs, loading state, file selection
    // ─────────────────────────────────────────────────────────────────────────────
    const $ui = makeState(() => {
        const savedDraft = localStorage.getItem('myapp3:messageDraft');
        if (savedDraft) console.log('📂 Restored message draft');

        return {
            loading: false,
            messageInput: savedDraft || 'Hello from the frontend!',
            selectedFile: null as File | null,

            // Computed values
            get canInteract(): boolean {
                return !$ui.loading && $core.isLoggedIn;
            },
            get hasFile(): boolean {
                return !!$ui.selectedFile;
            },
            get canUpload(): boolean {
                return $ui.canInteract && $ui.hasFile;
            },
            get fileDisplaySize(): string {
                if (!$ui.selectedFile) return '';
                const bytes: number = $ui.selectedFile.size;
                if (bytes < 1024) return `${bytes} B`;
                const kb = bytes / 1024;
                if (kb < 1024) return `${kb.toFixed(2)} KB`;
                return `${(kb / 1024).toFixed(2)} MB`;
            },
        };
    })
    .$withWatch({
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

    const logout = () => {
        if (!$core.client) return;
        
        // Clear client authentication
        $core.client.userId = undefined;
        $core.client.token = undefined;
        
        // Clear user and reset state
        $core.currentUser = '';
        $api.results.error = undefined;
        $api.results.greeting = '';
        
        console.log('✅ Successfully logged out');
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

    const streamCount = 5;
    const testStream = async () => {
        if (!$core.demoModule) return;

        $ui.loading = true;
        $api.results.streamData = [];
        $api.results.error = undefined;


        try {
            const stream = await $core.demoModule.testStream(streamCount);
            for await (const item of stream) {
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

    const clearResults = () => {
        // Clean up URLs to prevent memory leaks
        if ($api.downloadResults.fileUrl) {
            URL.revokeObjectURL($api.downloadResults.fileUrl);
        }


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



    const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        $ui.messageInput = e.target.value;
    };

    return (
        <div className="container">
            <h1>🚀🚀Poto Demo Frontend (Proxy Reactive) </h1>

            <div className="info">
                <h3>Connection Status 📡</h3>
                <p><strong>Status:</strong> {$core.isLoggedIn ? '✅ Logged In' : '❌ Not Logged In'}</p>
                <p><strong>Port:</strong> {Constants.port}</p>
                <p><strong>Current User:</strong> {$core.currentUser || 'Not logged in'}</p>
            </div>

            <div className="info" style={{ backgroundColor: '#e8f5e9', borderColor: '#4caf50' }}>
                <h3>🔍 Property Watchers Demo</h3>
                <p><small>
                    Active watchers: <strong>currentUser</strong>, <strong>messageInput</strong>
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
                        disabled={$ui.loading}
                    >
                        Login as Demo User
                    </button>
                    <button
                        onClick={() => login(Constants.adminUser, Constants.adminPassword)}
                        disabled={$ui.loading}
                    >
                        Login as Admin
                    </button>
                    <button
                        onClick={logout}
                        disabled={$ui.loading || !$core.isLoggedIn}
                        style={{ marginLeft: '20px', backgroundColor: '#d9534f' }}
                    >
                        Logout
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
                        Test Stream ({streamCount} items)
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

            {/* Audio Features in Separate Component */}
            <MyApp3Audio demoModule={$core.demoModule} isLoggedIn={$core.isLoggedIn} />

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
