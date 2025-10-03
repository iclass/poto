import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface StoredCredentials {
    username: string;
    password: string; // In a real app, this should be hashed
    serverUrl: string;
    lastLogin: string;
}

export class CredentialManager {
    private static readonly CREDENTIAL_FILE = '.credentials.json';
    private static readonly CREDENTIAL_DIR = path.join(__dirname, '..');
    private static readonly CREDENTIAL_PATH = path.join(CredentialManager.CREDENTIAL_DIR, CredentialManager.CREDENTIAL_FILE);

    /**
     * Save credentials to file
     */
    static saveCredentials(credentials: StoredCredentials): void {
        try {
            // Ensure directory exists
            if (!fs.existsSync(CredentialManager.CREDENTIAL_DIR)) {
                fs.mkdirSync(CredentialManager.CREDENTIAL_DIR, { recursive: true });
            }

            // Encrypt the password before storing (simple encryption for demo)
            const encryptedCredentials = {
                ...credentials,
                password: CredentialManager.encrypt(credentials.password)
            };

            fs.writeFileSync(
                CredentialManager.CREDENTIAL_PATH,
                JSON.stringify(encryptedCredentials, null, 2)
            );
        } catch (error) {
            throw new Error(`Failed to save credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Load credentials from file
     */
    static loadCredentials(): StoredCredentials | null {
        try {
            if (!fs.existsSync(CredentialManager.CREDENTIAL_PATH)) {
                return null;
            }

            const data = fs.readFileSync(CredentialManager.CREDENTIAL_PATH, 'utf8');
            const encryptedCredentials = JSON.parse(data);

            // Decrypt the password
            const credentials: StoredCredentials = {
                ...encryptedCredentials,
                password: CredentialManager.decrypt(encryptedCredentials.password)
            };

            return credentials;
        } catch (error) {
            console.warn('Failed to load credentials:', error);
            return null;
        }
    }

    /**
     * Clear stored credentials
     */
    static clearCredentials(): void {
        try {
            if (fs.existsSync(CredentialManager.CREDENTIAL_PATH)) {
                fs.unlinkSync(CredentialManager.CREDENTIAL_PATH);
            }
        } catch (error) {
            console.warn('Failed to clear credentials:', error);
        }
    }

    /**
     * Check if credentials exist
     */
    static hasCredentials(): boolean {
        return fs.existsSync(CredentialManager.CREDENTIAL_PATH);
    }

    /**
     * Simple encryption for demo purposes
     * In production, use proper encryption libraries
     */
    private static encrypt(text: string): string {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync('demo-key', 'salt', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return iv.toString('hex') + ':' + encrypted;
    }

    /**
     * Simple decryption for demo purposes
     */
    private static decrypt(encryptedText: string): string {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync('demo-key', 'salt', 32);
        const [ivHex, encrypted] = encryptedText.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }
}
