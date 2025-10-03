import { PotoModule } from '../../src/server/PotoModule';
export declare class MyModule extends PotoModule {
    getHello_(): Promise<string>;
    getStream_(): AsyncGenerator<{
        message: string;
        timestamp: string;
    }>;
}
//# sourceMappingURL=server.d.ts.map