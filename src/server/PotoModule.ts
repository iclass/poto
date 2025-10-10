import { PotoRequestContext } from "./PotoRequestContext";
import { PotoUser } from "./UserProvider";
import { UserSessionProvider, UserSessionData, InMemorySessionProvider } from "./UserSessionProvider";
import { requestContextManager } from "./RequestContextManager";


export class PotoModule {
	
	// Session provider - injected by PotoServer
	public sessionProvider: UserSessionProvider;

	constructor(sessionProvider: UserSessionProvider = new InMemorySessionProvider()) {
		this.sessionProvider = sessionProvider;
	}

	/**
   * subclasses are not required to override this method so it defaults to the class name as convention
   * @returns the route of the module
   */
	getRoute(): string {
		return this.constructor.name;
	}

	/**
	 * Get the current request context (available during request processing)
	 * This provides access to request-scoped services like cancellation-aware LLM instances
	 * @returns RequestContext for the current request
	 */
	protected getRequestContext(): PotoRequestContext | undefined {
		return requestContextManager.getCurrentContext();
	}

	/**
	 * Get the current request's user
	 * @returns PotoUser for the current request, or undefined
	 */
	protected getCurrentUser(): PotoUser | undefined {
		return (this.getRequestContext())?.user;
	}

	/**
	 * Check if the current request has been cancelled
	 * @returns true if client has disconnected/cancelled
	 */
	protected isRequestCancelled(): boolean {
		const context = this.getRequestContext();
		return context?.isCancelled ?? false;
	}

	/**
	 * Utility to check if an error is due to cancellation
	 * Useful for error handling in business logic
	 * @param error The error to check
	 * @returns true if error is due to request cancellation
	 */
	protected isCancellationError(error: Error): boolean {
		return error.name === 'AbortError' ||
			error.message.toLowerCase().includes('abort') ||
			error.message.toLowerCase().includes('cancel');
	}


	/**
	 * Get or create session data for the current user
	 * Subclasses can override createDefaultSessionData() to customize initial session data
	 * @returns User session data
	 */
	protected async getUserSession(): Promise<UserSessionData> {
		const user = this.getCurrentUser();
		if (!user) {
			throw new Error('User not authenticated');
		}

		const userId = user.id;
		let session = await this.sessionProvider.getSession(userId);

		if (!session) {
			// Create new session
			session = this.createDefaultSessionData(userId);
			await this.sessionProvider.setSession(userId, session);
		} else {
			// Update last activity
			session.lastActivity = new Date();
			await this.sessionProvider.setSession(userId, session);
		}

		return session;
	}

	/**
	 * Create default session data for a new user
	 * Subclasses can override to provide custom initial data
	 * @param userId The user's ID
	 * @returns Default session data
	 */
	protected createDefaultSessionData(userId: string): UserSessionData {
		return {
			userId,
			createdAt: new Date(),
			lastActivity: new Date()
		};
	}

	/**
	 * Update session data for the current user
	 * @param updater Function to update session data
	 */
	protected async updateUserSession(updater: (session: UserSessionData) => void): Promise<void> {
		const session = await this.getUserSession();
		updater(session);
		await this.sessionProvider.setSession(session.userId, session);
	}

	/**
	 * Set a session value and persist it immediately
	 * @param key The session key to set
	 * @param value The value to store
	 */
	protected async setSessionValue(key: string, value: any): Promise<void> {
		await this.updateUserSession((session) => {
			(session as any)[key] = value;
		});
	}

	/**
	 * Get a session value
	 * @param key The session key to get
	 * @returns The value of the session key, or undefined if the key does not exist
	 */
	protected async getSessionValue<T = any>(key: string): Promise<T | undefined> {
		const session = await this.getUserSession();
		return (session as any)[key];
	}

	/**
	 * Delete session for the current user
	 */
	protected async deleteUserSession(): Promise<void> {
		const user = this.getCurrentUser();
		if (user) {
			await this.sessionProvider.deleteSession(user.id);
		}
	}

	/**
	 * Get session statistics (for monitoring/debugging)
	 */
	async getSessionStats(): Promise<{ activeSessions: number; userIds: string[] }> {
		return await this.sessionProvider.getStats();
	}
}
