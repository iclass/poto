import "./styles.css";
import { createRoot } from "react-dom/client";
import { PotoClient } from 'poto';
import { Constants, ServerInfo, GenData, ImageSize } from "./demoConsts";
import type { DemoModule } from "./DemoModule";
import { makeState } from "./stateUtils";


// the bundler makes sure the root is always there before this script is executed
// therefore, we can render the app immediately
const rootEl = document.getElementById("root");
console.log("now rendering MyApp3 with Proxy-based Reactive State");
const appRoot = createRoot(rootEl!)
appRoot.render(<MyApp3 />);

export function MyApp3() {
    const SessionData = "stored in seesion";

    // Clean API - Pure TypeScript initialization with lazy initialization!
    const $ = makeState(() => {
        const potoClient = new PotoClient(`http://localhost:${Constants.port}`);
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
        try {
            const arrayBuffer = await $.selectedFile.arrayBuffer();
            const imageBuffer = new Uint8Array(arrayBuffer);
            const imageSize = await $.demoModule.getImageSize(imageBuffer);
            $.results.imageSize = imageSize;
            $.results.error = undefined;
        } catch (error) {
            console.error('❌ Failed to get image size:', error);
            $.results.error = `Failed to get image size: ${error}`;
        } finally {
            $.loading = false;
        }
    };

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
        $.results = {
            greeting: undefined,
            echo: undefined,
            serverInfo: undefined,
            streamData: undefined,
            imageSize: undefined,
            adminSecret: undefined,
            error: undefined,
        };
    };

    const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        $.messageInput = e.target.value;
    };

    return (
        <div className="container">
            <h1>🚀 Poto Demo Frontend (Proxy-based Reactive State) </h1>

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
                        disabled={$.loading || !$.isConnected || !$.currentUser}
                    />
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
                        disabled={$.loading || !$.isConnected || !$.currentUser}
                    />
                    <button
                        onClick={getImageSize}
                        disabled={$.loading || !$.isConnected || !$.currentUser || !$.selectedFile}
                    >
                        Get Image Size
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
