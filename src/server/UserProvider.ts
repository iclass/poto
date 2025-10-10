import { randomUUID } from "crypto"
import { MessagingClient, SseDispatcher, SseMessage } from "../shared/MessageClient"

export type ROLE = 'user' | 'admin'

export class PotoUser {

	feedMessage?: SseDispatcher

	constructor(
		public id:string,
		public passwordHash:string,
		/** the roles are used by the role-based autorizatoins in PotoModule */
		public roles: string[]
	){}
	sendMessage(from: string, note: string, payload?: object) {
		this.feedMessage!(new SseMessage(
			randomUUID(),
			from,
			this.id,
			note,
			payload
		))
	}

}

export interface UserProvider {
	/**
	 * @param uid - The user's unique identifier
	 * @returns The user if found, undefined otherwise
	 */
	findUserByUserId(uid:string): Promise<PotoUser | undefined>

	/**
	 *
	 * @param user
	 * @returns true if action succeed, false otherwise
	 */
	addUser(user:PotoUser):Promise<boolean>
}

