/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Audio Features Demo - Pure UI Component with React
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Logic and state management is in MyApp3Audio.logic.ts
 * Uses shared DemoModule singleton - no prop drilling needed!
 * 
 * JSX: React (default)
 */

import { useAudioFeatures } from "./MyApp3Audio.logic";
export function MyApp3Audio(isLoggedIn: boolean) {
    
    // Get all state and handlers from logic layer
    const audio = useAudioFeatures(isLoggedIn);

    // ─────────────────────────────────────────────────────────────────────────────
    // PURE UI RENDERING
    // ─────────────────────────────────────────────────────────────────────────────

    return (
        <div className="audio-demo-container">
            <h2>🎵 Audio Features Demo</h2>

            {/* HTML5 Audio Section */}
            <div className="demo-section">
                <h3>🎵 Audio Download & Playback (HTML5)</h3>
                <div className="button-group">
                    <button
                        onClick={audio.downloadAudio}
                        disabled={!audio.isLoggedIn}
                    >
                        Download & Play Audio (HTML5)
                    </button>
                </div>
                {audio.$audio.html5Audio.url && (
                    <div style={{ margin: '10px 0' }}>
                        <audio 
                            controls 
                            src={audio.$audio.html5Audio.url}
                            autoPlay={audio.$audio.autoPlayAudio}
                            style={{ width: '100%', maxWidth: '500px' }}
                        />
                    </div>
                )}
                <div className="info-box">
                    <p>Downloads complete audio file and plays using HTML5 {'<audio>'} element.</p>
                    <p>Simple but requires full download before playback.</p>
                </div>
            </div>

            {/* Web Audio API Section */}
            <div className="demo-section">
                <h3>🎛️ Web Audio API Playback</h3>
                <div className="button-group">
                    <button
                        onClick={audio.downloadWebAudio}
                        disabled={!audio.isLoggedIn}
                    >
                        Download for Web Audio
                    </button>
                    <button
                        onClick={audio.playWebAudio}
                        disabled={!audio.$audio.hasWebAudioData || audio.$audio.webAudio.isPlaying}
                    >
                        ▶️ Play
                    </button>
                    <button
                        onClick={audio.pauseWebAudio}
                        disabled={!audio.$audio.webAudio.isPlaying}
                    >
                        ⏸️ Pause
                    </button>
                    <button
                        onClick={audio.resumeWebAudio}
                        disabled={!audio.$audio.webAudio.isPaused}
                    >
                        ▶️ Resume
                    </button>
                    <button
                        onClick={audio.stopWebAudio}
                        disabled={!audio.$audio.webAudio.isPlaying && !audio.$audio.webAudio.isPaused}
                    >
                        ⏹️ Stop
                    </button>
                </div>
                <div className="info-box">
                    <p>Uses Media Source Extensions (MSE) for advanced audio control.</p>
                    <p><strong>State:</strong> {audio.$audio.webAudioState}</p>
                    {audio.$audio.webAudio.duration && (
                        <p><strong>Duration:</strong> {audio.$audio.webAudio.duration.toFixed(2)}s</p>
                    )}
                </div>
            </div>

            {/* Streaming Audio Section */}
            <div className="demo-section">
                <h3>🌊 Progressive Streaming Audio (ReadableStream)</h3>
                <div className="button-group">
                    <button
                        onClick={audio.streamAudio}
                        disabled={!audio.isLoggedIn || audio.$audio.streamingAudio.isStreaming}
                    >
                        {audio.$audio.streamingAudio.isStreaming ? '🌊 Streaming...' : 'Start Streaming'}
                    </button>
                    <button
                        onClick={audio.playStreamingAudio}
                        disabled={!audio.$audio.hasStreamingAudioData || audio.$audio.streamingAudio.isPlaying || audio.$audio.streamingAudio.isStreaming}
                    >
                        ▶️ Play
                    </button>
                    <button
                        onClick={audio.pauseStreamingAudio}
                        disabled={!audio.$audio.streamingAudio.isPlaying}
                    >
                        ⏸️ Pause
                    </button>
                    <button
                        onClick={audio.stopStreamingAudio}
                        disabled={!audio.$audio.streamingAudio.isPlaying && !audio.$audio.streamingAudio.isPaused}
                    >
                        ⏹️ Stop
                    </button>
                </div>
                <div className="info-box">
                    <p>Streams audio progressively, plays as data arrives!</p>
                    <p><strong>State:</strong> {audio.$audio.streamingAudioState}</p>
                    {audio.$audio.streamingProgressDisplay && (
                        <p><strong>Received:</strong> {audio.$audio.streamingProgressDisplay}</p>
                    )}
                    {audio.$audio.streamingAudio.duration && (
                        <p><strong>Duration:</strong> {audio.$audio.streamingAudio.duration.toFixed(2)}s</p>
                    )}
                </div>
                <div className="info-box" style={{ backgroundColor: '#e3f2fd', borderColor: '#2196f3' }}>
                    <label>
                        <input
                            type="checkbox"
                            checked={audio.$audio.autoPlayAudio}
                            onChange={(e) => (audio.$audio.autoPlayAudio = e.target.checked)}
                        />
                        {' '}Auto-play audio (saved to localStorage)
                    </label>
                </div>
            </div>
        </div>
    );
}
