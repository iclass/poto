/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MyApp3 - Pure UI Component with React
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Logic and state management is in MyApp3.logic.ts
 * Demonstrates clean separation of concerns for large components
 * 
 * JSX: React (default)
 */

import { Constants } from "./demoConsts";
import { MyApp3Audio } from "./MyApp3Audio";
import { useMyApp3Logic } from "./MyApp3.logic";
export function MyApp3() {
    
    // Get all state and handlers from logic layer
    const app = useMyApp3Logic();

    // ─────────────────────────────────────────────────────────────────────────────
    // PURE UI RENDERING
    // ─────────────────────────────────────────────────────────────────────────────

    return (
        <div className="container">
            <h1>🚀🚀Poto Demo Frontend (Proxy Reactive) </h1>

            <div className="info">
                <h3>Connection Status 📡</h3>
                <p><strong>Status:</strong> {app.$core.isLoggedIn ? '✅ Logged In' : '❌ Not Logged In'}</p>
                <p><strong>Port:</strong> {Constants.port}</p>
                <p><strong>Current User:</strong> {app.$core.currentUser || 'Not logged in'}</p>
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

            {app.$api.results.error && (
                <div className="error">
                    <h3>❌ Error</h3>
                    <p>{app.$api.results.error}</p>
                </div>
            )}

            <div className="demo-section">
                <h3>🔐 Authentication</h3>
                <div className="button-group">
                    <button
                        onClick={() => app.login(Constants.demoUser, Constants.demoPassword)}
                        disabled={app.$ui.loading}
                    >
                        Login as Demo User
                    </button>
                    <button
                        onClick={() => app.login(Constants.adminUser, Constants.adminPassword)}
                        disabled={app.$ui.loading}
                    >
                        Login as Admin
                    </button>
                    <button
                        onClick={app.logout}
                        disabled={app.$ui.loading || !app.$core.isLoggedIn}
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
                        onClick={app.getGreeting}
                        disabled={!app.$ui.canInteract}
                    >
                        Get Greeting
                    </button>
                    <button
                        onClick={app.getServerInfo}
                        disabled={!app.$ui.canInteract}
                    >
                        Get Server Info
                    </button>
                </div>

                {app.$api.results.greeting && (
                    <div className="result">
                        <h4>📨 Greeting Response:</h4>
                        <p>{app.$api.results.greeting}</p>
                    </div>
                )}

                {app.$api.results.serverInfo && (
                    <div className="result">
                        <h4>📊 Server Info:</h4>
                        <pre>{JSON.stringify(app.$api.results.serverInfo, null, 2)}</pre>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>💬 Message Echo</h3>
                <div className="input-group">
                    <input
                        type="text"
                        value={app.$ui.messageInput}
                        onChange={app.handleMessageInputChange}
                        placeholder="Enter a message..."
                        disabled={!app.$ui.canInteract} />
                    <button
                        onClick={app.sendMessage}
                        disabled={!app.$ui.canInteract}
                    >
                        Send Message
                    </button>
                </div>

                {app.$api.results.echo && (
                    <div className="result">
                        <h4>📨 Echo Response:</h4>
                        <p>{app.$api.results.echo}</p>
                    </div>
                )}
            </div>

            <div className="demo-section">
                <h3>🌊 Streaming Test</h3>
                <div className="button-group">
                    <button
                        onClick={app.testStream}
                        disabled={!app.$ui.canInteract}
                    >
                        Test Stream ({app.streamCount} items)
                    </button>
                </div>

                {app.$api.results.streamData && app.$api.results.streamData.length > 0 && (
                    <div className="result">
                        <h4>📨 Stream Data:</h4>
                        {app.$api.results.streamData.map((item, index) => (
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
                        onChange={app.handleFileUpload}
                        disabled={!app.$ui.canInteract} />
                    <button
                        onClick={app.getImageSize}
                        disabled={!app.$ui.canUpload}
                    >
                        Upload (Uint8Array)
                    </button>
                    <button
                        onClick={app.getImageSizeArrayBuffer}
                        disabled={!app.$ui.canUpload}
                    >
                        Upload (ArrayBuffer)
                    </button>
                    <button
                        onClick={app.getImageSizeDirectFile}
                        disabled={!app.$ui.canUpload}
                    >
                        Upload (File) ✨
                    </button>
                </div>

                {app.$api.results.imageSize && (
                    <div className="result">
                        <h4>📐 Image Size (One-Way Upload):</h4>
                        <p>Width: {app.$api.results.imageSize.width}px | Height: {app.$api.results.imageSize.height}px</p>
                        <p><small>✅ Binary uploaded to server successfully! Server returned only dimensions (no echo).</small></p>
                        {app.$api.results.uploadTiming && (
                            <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #ddd' }}>
                                <p><strong>⏱️ Performance:</strong></p>
                                <p>• File size: {(app.$api.results.uploadTiming.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                                <p>• RPC upload time: {app.$api.results.uploadTiming.rpcTime.toFixed(2)} ms</p>
                                <p>• Total round-trip time (upload + receive dimensions): <strong>{app.$api.results.uploadTiming.totalTime.toFixed(2)} ms</strong></p>
                                <p>• Upload throughput: {((app.$api.results.uploadTiming.fileSize / 1024 / 1024) / (app.$api.results.uploadTiming.rpcTime / 1000)).toFixed(2)} MB/s</p>
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
                        onClick={app.downloadAsFile}
                        disabled={!app.$ui.canInteract}
                    >
                        Download as File (RPC)
                    </button>
                    <button
                        onClick={app.downloadAsArrayBuffer}
                        disabled={!app.$ui.canInteract}
                    >
                        Download as ArrayBuffer (RPC)
                    </button>
                    <button
                        onClick={app.downloadViaStaticUrl}
                        disabled={app.$ui.loading}
                    >
                        Download via Static URL
                    </button>
                </div>

                {(app.$api.downloadResults.fileTime || app.$api.downloadResults.arrayBufferTime || app.$api.downloadResults.staticUrlTime) && (
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
                                {app.$api.downloadResults.fileTime !== undefined && (
                                    <tr>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>File (RPC)</td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>
                                            {app.$api.downloadResults.fileTime.toFixed(2)} ms
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>
                                            {((app.$api.downloadResults.fileSize || 0) / 1024 / 1024 / (app.$api.downloadResults.fileTime / 1000)).toFixed(2)} MB/s
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                                            {(() => {
                                                const times = [app.$api.downloadResults.fileTime, app.$api.downloadResults.arrayBufferTime, app.$api.downloadResults.staticUrlTime].filter(t => t !== undefined) as number[];
                                                const minTime = Math.min(...times);
                                                return app.$api.downloadResults.fileTime === minTime ? '🏆 Fastest' : '✅';
                                            })()}
                                        </td>
                                    </tr>
                                )}
                                {app.$api.downloadResults.arrayBufferTime !== undefined && (
                                    <tr>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>ArrayBuffer (RPC)</td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>
                                            {app.$api.downloadResults.arrayBufferTime.toFixed(2)} ms
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>
                                            {((app.$api.downloadResults.fileSize || 0) / 1024 / 1024 / (app.$api.downloadResults.arrayBufferTime / 1000)).toFixed(2)} MB/s
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                                            {(() => {
                                                const times = [app.$api.downloadResults.fileTime, app.$api.downloadResults.arrayBufferTime, app.$api.downloadResults.staticUrlTime].filter(t => t !== undefined) as number[];
                                                const minTime = Math.min(...times);
                                                return app.$api.downloadResults.arrayBufferTime === minTime ? '🏆 Fastest' : '✅';
                                            })()}
                                        </td>
                                    </tr>
                                )}
                                {app.$api.downloadResults.staticUrlTime !== undefined && (
                                    <tr>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>Static URL</td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>
                                            {app.$api.downloadResults.staticUrlTime.toFixed(2)} ms
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>
                                            {((app.$api.downloadResults.fileSize || 0) / 1024 / 1024 / (app.$api.downloadResults.staticUrlTime / 1000)).toFixed(2)} MB/s
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                                            {(() => {
                                                const times = [app.$api.downloadResults.fileTime, app.$api.downloadResults.arrayBufferTime, app.$api.downloadResults.staticUrlTime].filter(t => t !== undefined) as number[];
                                                const minTime = Math.min(...times);
                                                return app.$api.downloadResults.staticUrlTime === minTime ? '🏆 Fastest' : '✅';
                                            })()}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        {app.$api.downloadResults.fileSize && (
                            <p style={{ marginTop: '10px' }}>
                                <small>File size: {(app.$api.downloadResults.fileSize / (1024 * 1024)).toFixed(2)} MB ({app.$api.downloadResults.fileSize.toLocaleString()} bytes)</small>
                            </p>
                        )}
                    </div>
                )}

                {app.$api.downloadResults.fileUrl && (
                    <div className="result">
                        <h4>📥 Downloaded as File:</h4>
                        <img
                            src={app.$api.downloadResults.fileUrl}
                            alt="Downloaded as File"
                            style={{ maxWidth: '300px', border: '2px solid #2196F3', borderRadius: '8px' }}
                        />
                    </div>
                )}

                {app.$api.downloadResults.arrayBufferUrl && (
                    <div className="result">
                        <h4>📥 Downloaded as ArrayBuffer:</h4>
                        <img
                            src={app.$api.downloadResults.arrayBufferUrl}
                            alt="Downloaded as ArrayBuffer"
                            style={{ maxWidth: '300px', border: '2px solid #FF9800', borderRadius: '8px' }}
                        />
                    </div>
                )}

                {app.$api.downloadResults.staticUrl && (
                    <div className="result">
                        <h4>📥 Downloaded via Static URL:</h4>
                        <img
                            src={app.$api.downloadResults.staticUrl}
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
                        onClick={app.testAdminSecret}
                        disabled={!app.$ui.canInteract}
                    >
                        Get Admin Secret
                    </button>
                </div>

                {app.$api.results.adminSecret && (
                    <div className="result">
                        <h4>🔐 Admin Secret:</h4>
                        <pre>{JSON.stringify(app.$api.results.adminSecret, null, 2)}</pre>
                    </div>
                )}
            </div>

            {/* 
            Audio Features in Separate Component 
            Uses shared DemoModule singleton - no need to pass it!
            */}

            {
                MyApp3Audio(app.$core.isLoggedIn)
            }

            <div className="demo-section">
                <button onClick={app.clearResults} className="clear-button">
                    Clear All Results
                </button>
            </div>

            {app.$ui.loading && (
                <div className="loading">
                    <p>⏳ Loading...</p>
                </div>
            )}
        </div>
    );
}
