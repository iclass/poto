import { describe, beforeEach, test as it, expect } from "bun:test";
import { PotoServer } from "../../../src/server/PotoServer";
import { PotoUser } from "../../../src/server/UserProvider";
import { TestRoleApi } from "./TestRoleApi";

// Helper to generate random port in safe range
function getRandomPort(): number {
	return Math.floor(Math.random() * 30000) + 30000;
}

describe("PotoServer Role-Based Authorization", () => {

	let server: PotoServer;
	let handler: any;

	beforeEach(() => {
		server = new PotoServer({
			port: getRandomPort(),
			staticDir: "./public",
			jwtSecret: "testSecret"
		});

		// Mock user provider with different users
		server.setUserProvider({
			async findUserByUserId(userId: string) {
				const users = {
					'admin-user': new PotoUser('admin-user', 'hash', ['admin']),
					'regular-user': new PotoUser('regular-user', 'hash', ['user']),
					'premium-user': new PotoUser('premium-user', 'hash', ['user', 'premium']),
					'moderator-user': new PotoUser('moderator-user', 'hash', ['moderator']),
					'guest-user': new PotoUser('guest-user', 'hash', ['guest'])
				};
				return users[userId] || null;
			},
			async addUser(user: PotoUser): Promise<boolean> {
				return true;
			}
		});

		// Add the role test module
		server.addModule(new TestRoleApi());
		handler = server["routeHandlers"][0];

	});

	// Helper function to create JWT token
	function createToken(userId: string): string {
		const jwt = require('jsonwebtoken');
		return jwt.sign({ userId }, server.jwtSecret, { expiresIn: '1h' });
	}

	it("should allow access to methods without @roles decorator without authentication", async () => {
		const req = new Request(`http://localhost/publicdata`, {
			method: "GET",
		});
		const res = await handler('get', `/testroles/publicdata`, null, req);

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ data: "public data" });
	});

	it("should allow access to methods without @roles decorator with authentication", async () => {
		const authString = `Bearer ${createToken('admin-user')}`;
		const req = new Request(`http://localhost/publicdata`, {
			method: "GET",
			headers: { Authorization: authString }
		});
		const res = await handler('get', `/testroles/publicdata`, authString, req);

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ data: "public data" });
	});

	it("should deny access to @roles methods without authentication", async () => {
		const req = new Request(`http://localhost/admindata`, {
			method: "GET",
		});
		const res = await handler('get', `/testroles/admindata`, null, req);

		expect(res.status).toBe(401);
		const data = await res.text();
		expect(data).toEqual("Unauthorized. User id not found.");
	});

	it("should allow access to @roles methods with correct single role", async () => {
		const authString = `Bearer ${createToken('admin-user')}`;
		const req = new Request(`http://localhost/admindata`, {
			method: "GET",
			headers: { Authorization: authString }
		});
		const res = await handler('get', `/testroles/admindata`, authString, req);

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ data: "admin data" });
	});

	it("should deny access to @roles methods with incorrect role", async () => {
		const authString = `Bearer ${createToken('regular-user')}`;
		const req = new Request(`http://localhost/admindata`, {
			method: "GET",
			headers: { Authorization: authString }
		});
		const res = await handler('get', `/testroles/admindata`, authString, req);

		expect(res.status).toBe(403);
		const data = await res.text();
		expect(data).toContain("Roles required: admin for getAdminData");
	});

	it("should allow access to @roles methods with multiple roles when user has one matching role", async () => {
		const authString = `Bearer ${createToken('premium-user')}`;
		const req = new Request(`http://localhost/userdata`, {
			method: "GET",
			headers: { Authorization: authString }
		});
		const res = await handler('get', `/testroles/userdata`, authString, req);

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ data: "user data" });
	});

	it("should deny access to @roles methods with multiple roles when user has no matching roles", async () => {
		const authString = `Bearer ${createToken('guest-user')}`;
		const req = new Request(`http://localhost/userdata`, {
			method: "GET",
			headers: { Authorization: authString }
		});
		const res = await handler('get', `/testroles/userdata`, authString, req);

		expect(res.status).toBe(403);
		const data = await res.text();
		expect(data).toContain("Roles required: user,premium for getUserData");
	});

	it("should allow access to @roles methods with specific role", async () => {
		const authString = `Bearer ${createToken('moderator-user')}`;
		const req = new Request(`http://localhost/moderatordata`, {
			method: "GET",
			headers: { Authorization: authString }
		});
		const res = await handler('get', `/testroles/moderatordata`, authString, req);

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ data: "moderator data" });
	});

	it("should deny access to @roles methods with invalid token", async () => {
		const authString = `Bearer invalid-token`;
		const req = new Request(`http://localhost/admindata`, {
			method: "GET",
			headers: { Authorization: authString }
		});
		const res = await handler('get', `/testroles/admindata`, authString, req);

		expect(res.status).toBe(401);
		const data = await res.text();
		expect(data).toContain("Unauthorized. User id not found.");
	});

	it("should handle user not found in database", async () => {
		const authString = `Bearer ${createToken('nonexistent-user')}`;
		const req = new Request(`http://localhost/admindata`, {
			method: "GET",
			headers: { Authorization: authString }
		});
		const res = await handler('get', `/testroles/admindata`, authString, req);

		expect(res.status).toBe(403);
		const data = await res.text();
		expect(data).toContain("Roles required: admin for getAdminData");
	});
});
