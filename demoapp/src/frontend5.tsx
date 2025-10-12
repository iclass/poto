// App.tsx
import "./styles.css";
import { createRoot } from "react-dom/client";
import React, { useEffect } from "react";
import { PotoClient } from "poto";
import { Constants, ServerInfo, GenData, ImageSize } from "./demoConsts";
import type { DemoModule } from "./DemoModule";
import { proxy, useSnapshot, ref } from "valtio";

// ---------- Root mounting (HMR-safe) ----------
const rootEl = document.getElementById("root")!;
console.log("now rendering MyApp5 with Valtio Reactive State");

if (import.meta.hot) {
    console.log("hot module reloading for MyApp5");
    const root = (import.meta.hot.data.root ??= createRoot(rootEl));
    root.render(<MyApp5 host="http://localhost" port={Constants.port} />);
} else {
    console.log("not hot module reloading");
    createRoot(rootEl).render(<MyApp5 host="http://localhost" port={Constants.port} />);
}

// ---------- Store types ----------
type Results = {
    greeting?: string;
    echo?: string;
    serverInfo?: ServerInfo;
    streamData?: GenData[];
    imageSize?: ImageSize;
    adminSecret?: { secret: string, adminUser: string, timestamp: string, clearance: string, message: string };
    error?: string;
};

// Reactive state - only plain data that needs to trigger UI updates
type ReactiveState = {
    isConnected: boolean;
    currentUser: string;
    loading: boolean;
    results: Results;
    messageInput: string;
    selectedFile: File | null;
};

// Non-reactive references - kept outside Valtio
type AppRefs = {
    client: PotoClient;
    demoModule: DemoModule;
};

// ---------- Store factory ----------
function createAppState(host: string, port: number) {
    const potoClient = new PotoClient(`${host}:${port}`);
    const module = potoClient.getProxy<DemoModule>(Constants.serverModuleName);
    console.log("✅ Poto client initialized in MyApp5");

    // Keep non-reactive objects separate
    const refs: AppRefs = {
        client: potoClient,
        demoModule: module,
    };

    // Only reactive data goes in Valtio proxy
    const state = proxy<ReactiveState>({
        isConnected: true,
        currentUser: "",
        loading: false,
        results: {},
        messageInput: "Hello from the frontend!",
        selectedFile: null,
    });

    return { state, refs };
}


// ---------- App ----------
export function MyApp5({
    host = "http://localhost",
    port = Constants.port,
}: {
    host?: string;
    port?: number;
}) {
    // Use React.useRef to ensure state is created only once and persists across renders
    const appRef = React.useRef<{ state: ReactiveState; refs: AppRefs } | null>(null);
    if (!appRef.current) {
        appRef.current = createAppState(host, port);
    }
    const { state, refs } = appRef.current;

    const snap = useSnapshot(state);
    
    const SessionData = "stored in session";

    useEffect(() => {
        return () => {
            // keep connections alive during HMR, but clean up on real unmounts
            if (!import.meta.hot && refs.client && typeof (refs.client as any).unsubscribe === "function") {
                (refs.client as any).unsubscribe();
                console.log("🧹 Cleaned up client");
            }
        };
    }, [refs]);

    const login = async (username: string, password: string) => {
        if (!refs.client) return;
        state.loading = true;
        try {
            await refs.client.login({ username, password });
            state.currentUser = username;
            state.results.error = undefined;
            console.log(`✅ Successfully logged in as ${username}`);
        } catch (error) {
            console.error("❌ Login failed:", error);
            state.results.error = `Login failed: ${error}`;
        } finally {
            state.loading = false;
        }
    };

    const getGreeting = async () => {
        if (!refs.demoModule) return;
        state.loading = true;
        try {
            const greeting = await refs.demoModule.hello_(SessionData);
            state.results.greeting = greeting;
            state.results.error = undefined;
        } catch (error) {
            console.error("❌ Failed to get greeting:", error);
            state.results.error = `Failed to get greeting: ${error}`;
        } finally {
            state.loading = false;
        }
    };

    const sendMessage = async () => {
        if (!refs.demoModule) return;
        state.loading = true;
        try {
            const echo = await refs.demoModule.postMessage_(state.messageInput);
            state.results.echo = echo;
            state.results.error = undefined;
            if (!echo.includes(SessionData)) {
                console.error("❌ Failed to retrieve session data in: " + echo);
                state.results.error = "failed to retrieve session data";
            }
        } catch (error) {
            console.error("❌ Failed to send message:", error);
            state.results.error = `Failed to send message: ${error}`;
        } finally {
            state.loading = false;
        }
    };

    const getServerInfo = async () => {
        if (!refs.demoModule) return;
        state.loading = true;
        try {
            const info = await refs.demoModule.getServerInfo();
            state.results.serverInfo = info;
            state.results.error = undefined;
        } catch (error) {
            console.error("❌ Failed to get server info:", error);
            state.results.error = `Failed to get server info: ${error}`;
        } finally {
            state.loading = false;
        }
    };

    const testStream = async () => {
        if (!refs.demoModule) return;
        state.loading = true;
        state.results.streamData = [];
        state.results.error = undefined;

        const buffer: GenData[] = [];
        try {
            const stream = await refs.demoModule.testStream(3);
            for await (const item of stream) {
                buffer.push(item);
                // spread to notify snapshots (immutability helps batched updates)
                state.results.streamData = [...buffer];
            }
        } catch (error) {
            console.error("❌ Failed to test stream:", error);
            state.results.error = `Failed to test stream: ${error}`;
        } finally {
            state.loading = false;
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;
        // Wrap File object with ref() to prevent Valtio from proxying it
        // This preserves the native File/Blob methods like arrayBuffer()
        state.selectedFile = file ? ref(file) : null;
    };

    const getImageSize = async () => {
        if (!refs.demoModule || !state.selectedFile) return;
        state.loading = true;
        try {
            const arrayBuffer = await state.selectedFile.arrayBuffer();
            const imageBuffer = new Uint8Array(arrayBuffer);
            const imageSize = await refs.demoModule.getImageSize(imageBuffer);
            state.results.imageSize = imageSize;
            state.results.error = undefined;
        } catch (error) {
            console.error("❌ Failed to get image size:", error);
            state.results.error = `Failed to get image size: ${error}`;
        } finally {
            state.loading = false;
        }
    };

    const testAdminSecret = async () => {
        if (!refs.demoModule) return;
        state.loading = true;
        try {
            const secret = await refs.demoModule.getAdminSecret();
            state.results.adminSecret = secret;
            state.results.error = undefined;
        } catch (error) {
            console.error("❌ Failed to get admin secret:", error);
            state.results.error = `Failed to get admin secret: ${error}`;
        } finally {
            state.loading = false;
        }
    };

    const clearResults = () => {
        // mutate fields (reassign also works, but this avoids dropping object identity)
        state.results.greeting = undefined;
        state.results.echo = undefined;
        state.results.serverInfo = undefined;
        state.results.streamData = undefined;
        state.results.imageSize = undefined;
        state.results.adminSecret = undefined;
        state.results.error = undefined;
    };

    const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        state.messageInput = e.target.value;
    };

    return (
        <div className="container">
            <h1>🚀 Poto Demo Frontend (Valtio) </h1>

            <div className="info">
                <h3>Connection Status 📡</h3>
                <p><strong>Status:</strong> {snap.isConnected ? "✅ Connected" : "❌ Disconnected"}</p>
                <p><strong>Port:</strong> {port}</p>
                <p><strong>Current User:</strong> {snap.currentUser || "Not logged in"}</p>
            </div>

            {snap.results?.error && (
                <div className="error">
                    <h3>❌ Error</h3>
                    <p>{snap.results.error}</p>
                </div>
            )}

            <div className="demo-section">
                <h3>🔐 Authentication</h3>
                <div className="button-group">
                    <button onClick={() => login(Constants.demoUser, Constants.demoPassword)} disabled={snap.loading || !snap.isConnected}>
                        Login as Demo User
                    </button>
                    <button onClick={() => login(Constants.adminUser, Constants.adminPassword)} disabled={snap.loading || !snap.isConnected}>
                        Login as Admin
                    </button>
                </div>
            </div>

            <div className="demo-section">
                <h3>📝 Basic RPC Calls</h3>
                <div className="button-group">
                    <button onClick={getGreeting} disabled={snap.loading || !snap.isConnected || !snap.currentUser}>
                        Get Greeting
                    </button>
                    <button onClick={getServerInfo} disabled={snap.loading || !snap.isConnected || !snap.currentUser}>
                        Get Server Info
                    </button>
                </div>

                {snap.results?.greeting && (
                    <div className="result">
                        <h4>📨 Greeting Response:</h4>
                        <p>{snap.results.greeting}</p>
                    </div>
                )}

                {snap.results?.serverInfo && (
                    <div className="result">
                        <h4>📊 Server Info:</h4>
                        <pre>{JSON.stringify(snap.results.serverInfo, null, 2)}</pre>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>💬 Message Echo</h3>
                <div className="input-group">
                    <input
                        type="text"
                        value={snap.messageInput}
                        onChange={handleMessageInputChange}
                        placeholder="Enter a message..."
                        disabled={snap.loading || !snap.isConnected || !snap.currentUser}
                    />
                    <button onClick={sendMessage} disabled={snap.loading || !snap.isConnected || !snap.currentUser}>
                        Send Message
                    </button>
                </div>

                {snap.results?.echo && (
                    <div className="result">
                        <h4>📨 Echo Response:</h4>
                        <p>{snap.results.echo}</p>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>🌊 Streaming Test</h3>
                <div className="button-group">
                    <button onClick={testStream} disabled={snap.loading || !snap.isConnected || !snap.currentUser}>
                        Test Stream (3 items)
                    </button>
                </div>

                {snap.results?.streamData?.length ? (
                    <div className="result">
                        <h4>📨 Stream Data:</h4>
                        {snap.results.streamData.map((item: GenData, i: number) => (
                            <div key={i} className="stream-item">
                                <p><strong>Step {item.step}/{item.total}:</strong> {item.message}</p>
                                <p><small>User: {item.user} | Time: {item.timestamp}</small></p>
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>

            <div className="demo-section">
                <h3>🖼️ Image Upload</h3>
                <div className="input-group">
                    <input
                        type="file"
                        accept="image/png"
                        onChange={handleFileUpload}
                        disabled={snap.loading || !snap.isConnected || !snap.currentUser}
                    />
                    <button
                        onClick={getImageSize}
                        disabled={snap.loading || !snap.isConnected || !snap.currentUser || !snap.selectedFile}
                    >
                        Get Image Size
                    </button>
                </div>

                {snap.results?.imageSize && (
                    <div className="result">
                        <h4>📐 Image Size:</h4>
                        <p>Width: {snap.results.imageSize.width}px | Height: {snap.results.imageSize.height}px</p>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>🔒 Admin-Only Method</h3>
                <div className="button-group">
                    <button onClick={testAdminSecret} disabled={snap.loading || !snap.isConnected || !snap.currentUser}>
                        Get Admin Secret
                    </button>
                </div>

                {snap.results?.adminSecret && (
                    <div className="result">
                        <h4>🔐 Admin Secret:</h4>
                        <pre>{JSON.stringify(snap.results.adminSecret, null, 2)}</pre>
                    </div>
                )}

            </div>

            <div className="demo-section">
                <button onClick={clearResults} className="clear-button">
                    Clear All Results
                </button>
            </div>

            {snap.loading && (
                <div className="loading">
                    <p>⏳ Loading...</p>
                </div>
            )}
        </div>
    );
}
