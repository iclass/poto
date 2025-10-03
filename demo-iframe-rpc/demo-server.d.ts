import { PotoUser, UserProvider } from "../src/server/UserProvider";
/**
 * Demo user provider for testing
 */
export declare class DemoUserProvider implements UserProvider {
    userDB: Record<string, PotoUser>;
    constructor();
    static create(): Promise<DemoUserProvider>;
    findUserByUserId(uid: string): Promise<PotoUser>;
    addUser(user: PotoUser): Promise<boolean>;
}
//# sourceMappingURL=demo-server.d.ts.map