import { Constants, ServerInfo, GenData, ImageSize } from "./demoConsts";
import { makeReactiveState } from "./ReactiveState";
import { initServerConnection, clearServerConnection, getPotoClient, getServerModule } from "./serverConnection";
import { resetAllAudioPlayers } from "./MyApp3Audio.logic";

/**
 * MyApp3 Logic - State management and business logic
 * Separated from UI rendering for better organization and maintainability
 */
export function useMyApp3Logic(host: string = Constants.host, port: number = Constants.port) {
    const SessionData = "stored in seesion";
    const USER_KEY = 'myapp3:lastUser';
    const MSG_KEY = 'myapp3:messageDraft';


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
    
    
    const $core = makeReactiveState(() => {
        const { client } = initServerConnection(host, port, Constants.serverModuleName);
        return {
            client, // Store client in state for reactive property tracking
            currentUser: localStorage.getItem(USER_KEY) || '',

            get isLoggedIn(): boolean {
                // Access through reactive state so property changes are tracked
                return !!$core.client?.userId && !!$core.client?.token;
            },
        };
    }).$onUnmount(() => {
        clearServerConnection(); // Handles unsubscribe internally
        console.log('🧹 Poto client cleaned up');
    }).$withWatch({
        currentUser: (user, prevUser) => {
            if (user) {
                localStorage.setItem(USER_KEY, user);
                console.log('💾 [$core] User saved:', user);
            } else if (prevUser) {
                localStorage.removeItem(USER_KEY);
                console.log('🗑️  [$core] User removed');
            }
        },
    });


    // ─────────────────────────────────────────────────────────────────────────────
    // UI STATE - Form inputs, loading state, file selection
    // ─────────────────────────────────────────────────────────────────────────────
    const $ui = makeReactiveState({
        loading: false,
        messageInput: localStorage.getItem(MSG_KEY) || 'Hello from the frontend!',
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
        }
    }).$withWatch({
        messageInput: {
            handler: (message) => {
                if (message) {
                    localStorage.setItem(MSG_KEY, message);
                    console.log('💾 [$ui] Draft saved (length:', message.length, ')');
                }
            },
            debounce: 500
        },
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // API RESULTS STATE - All server call results
    // ─────────────────────────────────────────────────────────────────────────────
    const $api = makeReactiveState({
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

    // ─────────────────────────────────────────────────────────────────────────────
    // AUTHENTICATION HANDLERS
    // ─────────────────────────────────────────────────────────────────────────────

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

        // Clear client authentication - triggers reactive update
        $core.client.userId = undefined;
        $core.client.token = undefined;

        // Clear user and reset state
        $core.currentUser = '';
        $api.results.error = undefined;
        $api.results.greeting = '';

        console.log('✅ Successfully logged out');
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // BASIC RPC HANDLERS
    // ─────────────────────────────────────────────────────────────────────────────

    const getGreeting = async () => {
        const demoModule = getServerModule();
        if (!demoModule) return;

        $ui.loading = true;
        try {
            const greeting = await demoModule.hello_(SessionData);
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
        const demoModule = getServerModule();
        if (!demoModule) return;

        $ui.loading = true;
        try {
            const echo = await demoModule.postMessage_($ui.messageInput);
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
        const demoModule = getServerModule();
        if (!demoModule) return;

        $ui.loading = true;
        try {
            const serverInfo = await demoModule.getServerInfo();
            $api.results.serverInfo = serverInfo;
            $api.results.error = undefined;
        } catch (error) {
            console.error('❌ Failed to get server info:', error);
            $api.results.error = `Failed to get server info: ${error}`;
        } finally {
            $ui.loading = false;
        }
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // STREAMING HANDLER
    // ─────────────────────────────────────────────────────────────────────────────

    const streamCount = 5;
    const testStream = async () => {
        const demoModule = getServerModule();
        if (!demoModule) return;

        $ui.loading = true;
        $api.results.streamData = [];
        $api.results.error = undefined;


        try {
            const stream = await demoModule.testStream(streamCount);
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

    // ─────────────────────────────────────────────────────────────────────────────
    // FILE UPLOAD HANDLERS
    // ─────────────────────────────────────────────────────────────────────────────

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        $ui.selectedFile = file || null;
    };

    const getImageSize = async () => {
        const demoModule = getServerModule();
        if (!demoModule || !$ui.selectedFile) return;

        $ui.loading = true;
        const startTotal = performance.now();

        try {
            const arrayBuffer = await $ui.selectedFile.arrayBuffer();
            const imageBuffer = new Uint8Array(arrayBuffer);

            const startRpc = performance.now();
            const imageSize = await demoModule.getImageSize(imageBuffer);
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
        const demoModule = getServerModule();
        if (!demoModule || !$ui.selectedFile) return;

        $ui.loading = true;
        const startTotal = performance.now();

        try {
            const arrayBuffer = await $ui.selectedFile.arrayBuffer();

            const startRpc = performance.now();
            const imageSize = await demoModule.getImageSizeArrayBuffer(arrayBuffer);
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
        const demoModule = getServerModule();
        if (!demoModule || !$ui.selectedFile) return;

        $ui.loading = true;
        const startTotal = performance.now();

        try {
            const startRpc = performance.now();
            const imageSize = await demoModule.getImageSizeFile($ui.selectedFile);
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

    // ─────────────────────────────────────────────────────────────────────────────
    // FILE DOWNLOAD HANDLERS
    // ─────────────────────────────────────────────────────────────────────────────

    const downloadAsFile = async () => {

        $ui.loading = true;
        try {
            const startTime = performance.now();
            const file = await (getServerModule()!).downloadImageAsFile();
            console.log('downloadAsFile, file size:', file.size);
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
        const demoModule = getServerModule();
        if (!demoModule) return;

        $ui.loading = true;
        try {

            const startTime = performance.now();
            const arrayBuffer = await demoModule.downloadImageAsArrayBuffer();
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

    // ─────────────────────────────────────────────────────────────────────────────
    // ADMIN HANDLER
    // ─────────────────────────────────────────────────────────────────────────────

    const testAdminSecret = async () => {
        const demoModule = getServerModule();
        if (!demoModule) return;

        $ui.loading = true;
        try {
            const adminSecret = await demoModule.getAdminSecret();
            $api.results.adminSecret = adminSecret;
            $api.results.error = undefined;
        } catch (error) {
            console.error('❌ Failed to get admin secret:', error);
            $api.results.error = `Failed to get admin secret: ${error}`;
        } finally {
            $ui.loading = false;
        }
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // UTILITY HANDLERS
    // ─────────────────────────────────────────────────────────────────────────────

    const clearResults = () => {
        // Clean up URLs to prevent memory leaks
        if ($api.downloadResults.fileUrl) {
            URL.revokeObjectURL($api.downloadResults.fileUrl);
        }

        // Clear main app results
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

        // Clear audio players (HTML5, Web Audio, Streaming)
        resetAllAudioPlayers();

        console.log('✅ All results and audio players cleared');
    };

    const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        $ui.messageInput = e.target.value;
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // RETURN ALL STATE AND HANDLERS
    // ─────────────────────────────────────────────────────────────────────────────

    return {
        // State
        $core,
        $ui,
        $api,

        // Constants
        streamCount,

        // Authentication handlers
        login,
        logout,

        // Basic RPC handlers
        getGreeting,
        sendMessage,
        getServerInfo,

        // Streaming handler
        testStream,

        // File upload handlers
        handleFileUpload,
        getImageSize,
        getImageSizeArrayBuffer,
        getImageSizeDirectFile,

        // File download handlers
        downloadAsFile,
        downloadAsArrayBuffer,
        downloadViaStaticUrl,

        // Admin handler
        testAdminSecret,

        // Utility handlers
        clearResults,
        handleMessageInputChange,
    };
}

