import { PotoModule } from "../../../src/server/PotoModule";
import { roles } from "../../../src/server/serverDecorators";

export class TestRoleApi extends PotoModule {
    getRoute(): string {
        return "testroles";
    }

    // Method without roles - should work without authentication
    async getPublicData(): Promise<{ data: string; }> {
        return { data: "public data" };
    }

    // Method with single role requirement
    @roles('admin')
    async getAdminData(): Promise<{ data: string; }> {
        return { data: "admin data" };
    }

    // Method with multiple role requirements
    @roles('user', 'premium')
    async getUserData(): Promise<{ data: string; }> {
        return { data: "user data" };
    }

    // Method with specific role
    @roles('moderator')
    async getModeratorData(): Promise<{ data: string; }> {
        return { data: "moderator data" };
    }
}
