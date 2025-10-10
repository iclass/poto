import { UserProvider, PotoUser } from 'poto';
import { Constants } from './demoConsts';

// Simple in-memory user provider for demo
export class DemoUserProvider implements UserProvider {
    private users = new Map<string, PotoUser>();
    private initialized = false;


    public async findUserByUserId(userId: string): Promise<PotoUser | undefined> {
        return this.users.get(userId);
    }

    public async addUser(user: PotoUser): Promise<boolean> {
        this.users.set(user.id, user);
        return true;
    }

    static async create(): Promise<DemoUserProvider> {
        const provider = new DemoUserProvider();
        await provider.addUser(new PotoUser(Constants.demoUser, await Bun.password.hash(Constants.demoPassword), [Constants.roles.user]));
        await provider.addUser(new PotoUser(Constants.adminUser, await Bun.password.hash(Constants.adminPassword), [Constants.roles.user, Constants.roles.admin]));
        return provider;
    }
}
