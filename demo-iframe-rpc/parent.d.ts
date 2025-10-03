import { PotoClientWithProxy } from '../src/web/rpc/PotoClientWithProxy';
export declare let demoBridge: PotoClientWithProxy | null;
export declare let logElement: HTMLElement | null;
export declare let statusElement: HTMLElement | null;
export declare function log(message: string, type?: string): void;
export declare function updateStatus(message: string, type?: string): void;
export declare class DemoParentModule {
    getParentInfo(): Promise<{
        parentUrl: string;
        time: string;
    }>;
}
export declare function initRpcBridge(): Promise<void>;
export declare function initializeParentClient(): void;
export declare function clearParentLog(): void;
//# sourceMappingURL=parent.d.ts.map