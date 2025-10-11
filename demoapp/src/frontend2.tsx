import "./styles.css";
import { createRoot } from "react-dom/client";
import { useRef, useCallback, useState, useEffect } from "react";
import { PotoClient } from 'poto';
import { Constants, ServerInfo, GenData, ImageSize } from "./demoConsts";
import type { DemoModule } from "./DemoModule";

// Plain object to hold all state - no reactivity
interface AppState {
    client: PotoClient | null;
    demoModule: DemoModule | null;
    isConnected: boolean;
    currentUser: string;
    loading: boolean;
    results: {
        greeting?: string;
        echo?: string;
        serverInfo?: ServerInfo;
        streamData?: GenData[];
        imageSize?: ImageSize;
        adminSecret?: any;
        error?: string;
    };
    messageInput: string;
    selectedFile: File | null;
}

// the bundler makes sure the root is always there before this script is executed
// therefore, we can render the app immediately
const rootEl = document.getElementById("root");
console.log("now rendering MyApp2 with useRef + Force Update pattern");
const appRoot = createRoot(rootEl!)
appRoot.render(<MyApp2 />);

export function MyApp2() {
    // Plain object - no reactivity
    const state = useRef<AppState>({
        client: null,
        demoModule: null,
        isConnected: false,
        currentUser: '',
        loading: false,
        results: {},
        messageInput: 'Hello from the frontend!',
        selectedFile: null,
    });

    // Force update mechanism
    const [, forceUpdate] = useState({});
    const triggerUpdate = useCallback(() => {
        forceUpdate({});
    }, []);

    // State update functions with explicit control
    const updateState = useCallback((updates: Partial<AppState>, shouldRefresh = true) => {
        Object.assign(state.current, updates);
        if (shouldRefresh) {
            triggerUpdate();
        }
    }, [triggerUpdate]);

    const silentUpdate = useCallback((updates: Partial<AppState>) => {
        Object.assign(state.current, updates);
        // No triggerUpdate() - silent update
    }, []);

    // Initialize Poto client
    useEffect(() => {
        const initClient = async () => {
            try {
                const potoClient = new PotoClient(`http://localhost:${Constants.port}`);
                const module = potoClient.getProxy<DemoModule>(Constants.serverModuleName);
                
                // Batch multiple updates, then refresh once
                silentUpdate({
                    client: potoClient,
                    demoModule: module,
                    isConnected: true
                });
                triggerUpdate(); // Single UI update
                
                console.log('✅ Poto client initialized');
            } catch (error) {
                console.error('❌ Failed to initialize Poto client:', error);
                updateState({
                    results: { ...state.current.results, error: `Failed to connect: ${error}` }
                });
            }
        };

        initClient();
    }, [updateState, silentUpdate, triggerUpdate]);

    const login = async (username: string, password: string) => {
        if (!state.current.client) return;

        updateState({ loading: true }); // Show loading immediately
        
        try {
            await state.current.client.login({ username, password });
            
            // Batch multiple updates silently, then refresh once
            silentUpdate({
                currentUser: username,
                results: { ...state.current.results, error: undefined }
            });
            triggerUpdate(); // Single UI update
            
            console.log(`✅ Successfully logged in as ${username}`);
        } catch (error) {
            console.error('❌ Login failed:', error);
            updateState({
                results: { ...state.current.results, error: `Login failed: ${error}` }
            });
        } finally {
            updateState({ loading: false }); // Show loading complete
        }
    };

    const getGreeting = async () => {
        if (!state.current.demoModule) return;

        updateState({ loading: true });
        try {
            const greeting = await state.current.demoModule.hello_();
            updateState({
                results: { ...state.current.results, greeting, error: undefined }
            });
        } catch (error) {
            console.error('❌ Failed to get greeting:', error);
            updateState({
                results: { ...state.current.results, error: `Failed to get greeting: ${error}` }
            });
        } finally {
            updateState({ loading: false });
        }
    };

    const sendMessage = async () => {
        if (!state.current.demoModule) return;

        updateState({ loading: true });
        try {
            const echo = await state.current.demoModule.postMessage_(state.current.messageInput);
            updateState({
                results: { ...state.current.results, echo, error: undefined }
            });
        } catch (error) {
            console.error('❌ Failed to send message:', error);
            updateState({
                results: { ...state.current.results, error: `Failed to send message: ${error}` }
            });
        } finally {
            updateState({ loading: false });
        }
    };

    const getServerInfo = async () => {
        if (!state.current.demoModule) return;

        updateState({ loading: true });
        try {
            const serverInfo = await state.current.demoModule.getServerInfo();
            updateState({
                results: { ...state.current.results, serverInfo, error: undefined }
            });
        } catch (error) {
            console.error('❌ Failed to get server info:', error);
            updateState({
                results: { ...state.current.results, error: `Failed to get server info: ${error}` }
            });
        } finally {
            updateState({ loading: false });
        }
    };

    const testStream = async () => {
        if (!state.current.demoModule) return;

        updateState({ 
            loading: true,
            results: { ...state.current.results, streamData: [], error: undefined }
        });
        
        const streamData: GenData[] = [];

        try {
            const stream = await state.current.demoModule.testStream(3);
            for await (const item of stream) {
                streamData.push(item);
                // Update stream data in real-time
                updateState({
                    results: { ...state.current.results, streamData: [...streamData] }
                });
            }
        } catch (error) {
            console.error('❌ Failed to test stream:', error);
            updateState({
                results: { ...state.current.results, error: `Failed to test stream: ${error}` }
            });
        } finally {
            updateState({ loading: false });
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        updateState({ selectedFile: file || null });
    };

    const getImageSize = async () => {
        if (!state.current.demoModule || !state.current.selectedFile) return;

        updateState({ loading: true });
        try {
            const arrayBuffer = await state.current.selectedFile.arrayBuffer();
            const imageBuffer = new Uint8Array(arrayBuffer);
            const imageSize = await state.current.demoModule.getImageSize(imageBuffer);
            updateState({
                results: { ...state.current.results, imageSize, error: undefined }
            });
        } catch (error) {
            console.error('❌ Failed to get image size:', error);
            updateState({
                results: { ...state.current.results, error: `Failed to get image size: ${error}` }
            });
        } finally {
            updateState({ loading: false });
        }
    };

    const testAdminSecret = async () => {
        if (!state.current.demoModule) return;

        updateState({ loading: true });
        try {
            const adminSecret = await state.current.demoModule.getAdminSecret();
            updateState({
                results: { ...state.current.results, adminSecret, error: undefined }
            });
        } catch (error) {
            console.error('❌ Failed to get admin secret:', error);
            updateState({
                results: { ...state.current.results, error: `Failed to get admin secret: ${error}` }
            });
        } finally {
            updateState({ loading: false });
        }
    };

    const clearResults = () => {
        updateState({ results: {} });
    };

    const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateState({ messageInput: e.target.value });
    };

    return (
        <div className="container">
            <h1>🚀 Poto Demo Frontend (useRef + Force Update Pattern) </h1>

            <div className="info">
                <h3>Connection Status 📡</h3>
                <p><strong>Status:</strong> {state.current.isConnected ? '✅ Connected' : '❌ Disconnected'}</p>
                <p><strong>Port:</strong> {Constants.port}</p>
                <p><strong>Current User:</strong> {state.current.currentUser || 'Not logged in'}</p>
            </div>

            {state.current.results.error && (
                <div className="error">
                    <h3>❌ Error</h3>
                    <p>{state.current.results.error}</p>
                </div>
            )}

            <div className="demo-section">
                <h3>🔐 Authentication</h3>
                <div className="button-group">
                    <button
                        onClick={() => login(Constants.demoUser, Constants.demoPassword)}
                        disabled={state.current.loading || !state.current.isConnected}
                    >
                        Login as Demo User
                    </button>
                    <button
                        onClick={() => login(Constants.adminUser, Constants.adminPassword)}
                        disabled={state.current.loading || !state.current.isConnected}
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
                        disabled={state.current.loading || !state.current.isConnected || !state.current.currentUser}
                    >
                        Get Greeting
                    </button>
                    <button
                        onClick={getServerInfo}
                        disabled={state.current.loading || !state.current.isConnected || !state.current.currentUser}
                    >
                        Get Server Info
                    </button>
                </div>

                {state.current.results.greeting && (
                    <div className="result">
                        <h4>📨 Greeting Response:</h4>
                        <p>{state.current.results.greeting}</p>
                    </div>
                )}

                {state.current.results.serverInfo && (
                    <div className="result">
                        <h4>📊 Server Info:</h4>
                        <pre>{JSON.stringify(state.current.results.serverInfo, null, 2)}</pre>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>💬 Message Echo</h3>
                <div className="input-group">
                    <input
                        type="text"
                        value={state.current.messageInput}
                        onChange={handleMessageInputChange}
                        placeholder="Enter a message..."
                        disabled={state.current.loading || !state.current.isConnected || !state.current.currentUser}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={state.current.loading || !state.current.isConnected || !state.current.currentUser}
                    >
                        Send Message
                    </button>
                </div>

                {state.current.results.echo && (
                    <div className="result">
                        <h4>📨 Echo Response:</h4>
                        <p>{state.current.results.echo}</p>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>🌊 Streaming Test</h3>
                <div className="button-group">
                    <button
                        onClick={testStream}
                        disabled={state.current.loading || !state.current.isConnected || !state.current.currentUser}
                    >
                        Test Stream (3 items)
                    </button>
                </div>

                {state.current.results.streamData && state.current.results.streamData.length > 0 && (
                    <div className="result">
                        <h4>📨 Stream Data:</h4>
                        {state.current.results.streamData.map((item, index) => (
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
                        disabled={state.current.loading || !state.current.isConnected || !state.current.currentUser}
                    />
                    <button
                        onClick={getImageSize}
                        disabled={state.current.loading || !state.current.isConnected || !state.current.currentUser || !state.current.selectedFile}
                    >
                        Get Image Size
                    </button>
                </div>

                {state.current.results.imageSize && (
                    <div className="result">
                        <h4>📐 Image Size:</h4>
                        <p>Width: {state.current.results.imageSize.width}px | Height: {state.current.results.imageSize.height}px</p>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>🔒 Admin-Only Method</h3>
                <div className="button-group">
                    <button
                        onClick={testAdminSecret}
                        disabled={state.current.loading || !state.current.isConnected || !state.current.currentUser}
                    >
                        Get Admin Secret
                    </button>
                </div>

                {state.current.results.adminSecret && (
                    <div className="result">
                        <h4>🔐 Admin Secret:</h4>
                        <pre>{JSON.stringify(state.current.results.adminSecret, null, 2)}</pre>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <button onClick={clearResults} className="clear-button">
                    Clear All Results
                </button>
            </div>

            {state.current.loading && (
                <div className="loading">
                    <p>⏳ Loading...</p>
                </div>
            )}
        </div>
    );
}
