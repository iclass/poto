import "./styles.css";
import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";
import { PotoClient } from 'poto';
import { Constants, ServerInfo, GenData, ImageSize } from "./demoConsts";
import type { DemoModule } from "./DemoModule";


// the bundler makes sure the root is always there before this script is executed
// therefore, we can render the app immediately
const rootEl = document.getElementById("root");
console.log("now rendering MyApp");
const appRoot = createRoot(rootEl!)
appRoot.render(<MyApp />);


// the following code is more conservative and it works to ensure that the DOM is fully loaded before we render the ap

// function start() {
//     const root = createRoot(document.getElementById("root")!);
//     console.log("Rendering MyApp");
//     root.render(<MyApp />);
// }
// we must consider the timing of the script being loaded
// we want to make sure that the DOM is fully loaded before we render the app
// if (document.readyState === "loading") {
//     // still loading, so we wait for the DOM to be fully loaded
//     document.addEventListener("DOMContentLoaded", start);
// } else {
//     // otherwise, render the app immediately
//     start();
// }


export function MyApp() {
    const [client, setClient] = useState<PotoClient | null>(null);
    const [demoModule, setDemoModule] = useState<DemoModule | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [currentUser, setCurrentUser] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<{
        greeting?: string;
        echo?: string;
        serverInfo?: ServerInfo;
        streamData?: GenData[];
        imageSize?: ImageSize;
        adminSecret?: any;
        error?: string;
    }>({});
    const [messageInput, setMessageInput] = useState('Hello from the frontend!');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Initialize Poto client
    useEffect(() => {
        const initClient = async () => {
            try {
                const potoClient = new PotoClient(`http://localhost:${Constants.port}`);
                const module = potoClient.getProxy<DemoModule>(Constants.serverModuleName);
                setClient(potoClient);
                setDemoModule(module);
                setIsConnected(true);
                console.log('✅ Poto client initialized');
            } catch (error) {
                console.error('❌ Failed to initialize Poto client:', error);
                setResults(prev => ({ ...prev, error: `Failed to connect: ${error}` }));
            }
        };

        initClient();
    }, []);

    const login = async (username: string, password: string) => {
        if (!client) return;

        setLoading(true);
        try {
            await client.login({ username, password });
            setCurrentUser(username);
            setResults(prev => ({ ...prev, error: undefined }));
            console.log(`✅ Successfully logged in as ${username}`);
        } catch (error) {
            console.error('❌ Login failed:', error);
            setResults(prev => ({ ...prev, error: `Login failed: ${error}` }));
        } finally {
            setLoading(false);
        }
    };

    const getGreeting = async () => {
        if (!demoModule) return;

        setLoading(true);
        try {
            const greeting = await demoModule.hello_("hi...");
            setResults(prev => ({ ...prev, greeting, error: undefined }));
        } catch (error) {
            console.error('❌ Failed to get greeting:', error);
            setResults(prev => ({ ...prev, error: `Failed to get greeting: ${error}` }));
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async () => {
        if (!demoModule) return;

        setLoading(true);
        try {
            const echo = await demoModule.postMessage_(messageInput);
            setResults(prev => ({ ...prev, echo, error: undefined }));
        } catch (error) {
            console.error('❌ Failed to send message:', error);
            setResults(prev => ({ ...prev, error: `Failed to send message: ${error}` }));
        } finally {
            setLoading(false);
        }
    };

    const getServerInfo = async () => {
        if (!demoModule) return;

        setLoading(true);
        try {
            const serverInfo = await demoModule.getServerInfo();
            setResults(prev => ({ ...prev, serverInfo, error: undefined }));
        } catch (error) {
            console.error('❌ Failed to get server info:', error);
            setResults(prev => ({ ...prev, error: `Failed to get server info: ${error}` }));
        } finally {
            setLoading(false);
        }
    };

    const testStream = async () => {
        if (!demoModule) return;

        setLoading(true);
        const streamData: GenData[] = [];
        setResults(prev => ({ ...prev, streamData: [], error: undefined }));

        try {
            const stream = await demoModule.testStream(3);
            for await (const item of stream) {
                streamData.push(item);
                setResults(prev => ({ ...prev, streamData: [...streamData] }));
            }
        } catch (error) {
            console.error('❌ Failed to test stream:', error);
            setResults(prev => ({ ...prev, error: `Failed to test stream: ${error}` }));
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        setSelectedFile(file || null);
    };

    const getImageSize = async () => {
        if (!demoModule || !selectedFile) return;

        setLoading(true);
        try {
            const arrayBuffer = await selectedFile.arrayBuffer();
            const imageBuffer = new Uint8Array(arrayBuffer);
            const imageSize = await demoModule.getImageSize(imageBuffer);
            setResults(prev => ({ ...prev, imageSize, error: undefined }));
        } catch (error) {
            console.error('❌ Failed to get image size:', error);
            setResults(prev => ({ ...prev, error: `Failed to get image size: ${error}` }));
        } finally {
            setLoading(false);
        }
    };

    const testAdminSecret = async () => {
        if (!demoModule) return;

        setLoading(true);
        try {
            const adminSecret = await demoModule.getAdminSecret();
            setResults(prev => ({ ...prev, adminSecret, error: undefined }));
        } catch (error) {
            console.error('❌ Failed to get admin secret:', error);
            setResults(prev => ({ ...prev, error: `Failed to get admin secret: ${error}` }));
        } finally {
            setLoading(false);
        }
    };

    const clearResults = () => {
        setResults({});
    };

    return (
        <div className="container">
            <h1>🚀 Poto Demo Frontend </h1>

            <div className="info">
                <h3>Connection Status 📡</h3>
                <p><strong>Status:</strong> {isConnected ? '✅ Connected' : '❌ Disconnected'}</p>
                <p><strong>Port:</strong> {Constants.port}</p>
                <p><strong>Current User:</strong> {currentUser || 'Not logged in'}</p>
            </div>

            {results.error && (
                <div className="error">
                    <h3>❌ Error</h3>
                    <p>{results.error}</p>
                </div>
            )}

            <div className="demo-section">
                <h3>🔐 Authentication</h3>
                <div className="button-group">
                    <button
                        onClick={() => login(Constants.demoUser, Constants.demoPassword)}
                        disabled={loading || !isConnected}
                    >
                        Login as Demo User
                    </button>
                    <button
                        onClick={() => login(Constants.adminUser, Constants.adminPassword)}
                        disabled={loading || !isConnected}
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
                        disabled={loading || !isConnected || !currentUser}
                    >
                        Get Greeting
                    </button>
                    <button
                        onClick={getServerInfo}
                        disabled={loading || !isConnected || !currentUser}
                    >
                        Get Server Info
                    </button>
                </div>

                {results.greeting && (
                    <div className="result">
                        <h4>📨 Greeting Response:</h4>
                        <p>{results.greeting}</p>
                    </div>
                )}

                {results.serverInfo && (
                    <div className="result">
                        <h4>📊 Server Info:</h4>
                        <pre>{JSON.stringify(results.serverInfo, null, 2)}</pre>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>💬 Message Echo</h3>
                <div className="input-group">
                    <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder="Enter a message..."
                        disabled={loading || !isConnected || !currentUser}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={loading || !isConnected || !currentUser}
                    >
                        Send Message
                    </button>
                </div>

                {results.echo && (
                    <div className="result">
                        <h4>📨 Echo Response:</h4>
                        <p>{results.echo}</p>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>🌊 Streaming Test</h3>
                <div className="button-group">
                    <button
                        onClick={testStream}
                        disabled={loading || !isConnected || !currentUser}
                    >
                        Test Stream (3 items)
                    </button>
                </div>

                {results.streamData && results.streamData.length > 0 && (
                    <div className="result">
                        <h4>📨 Stream Data:</h4>
                        {results.streamData.map((item, index) => (
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
                        disabled={loading || !isConnected || !currentUser}
                    />
                    <button
                        onClick={getImageSize}
                        disabled={loading || !isConnected || !currentUser || !selectedFile}
                    >
                        Get Image Size
                    </button>
                </div>

                {results.imageSize && (
                    <div className="result">
                        <h4>📐 Image Size:</h4>
                        <p>Width: {results.imageSize.width}px | Height: {results.imageSize.height}px</p>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>🔒 Admin-Only Method</h3>
                <div className="button-group">
                    <button
                        onClick={testAdminSecret}
                        disabled={loading || !isConnected || !currentUser}
                    >
                        Get Admin Secret
                    </button>
                </div>

                {results.adminSecret && (
                    <div className="result">
                        <h4>🔐 Admin Secret:</h4>
                        <pre>{JSON.stringify(results.adminSecret, null, 2)}</pre>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <button onClick={clearResults} className="clear-button">
                    Clear All Results
                </button>
            </div>

            {loading && (
                <div className="loading">
                    <p>⏳ Loading...</p>
                </div>
            )}
        </div>
    )
}

