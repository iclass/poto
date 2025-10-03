import { DialogueJournal } from './DialogueJournal';
import { FileSystemDialogueJournal, FileSystemDialogueJournalConfig } from './FileSystemDialogueJournal';
import { VolatileMemoryDialogueJournal, VolatileMemoryDialogueJournalConfig } from './VolatileMemoryDialogueJournal';

export type DialogueJournalBackend = 'memory' | 'filesystem' | 'redis';

export interface DialogueJournalFactoryConfig {
    backend: DialogueJournalBackend;
    memory?: VolatileMemoryDialogueJournalConfig;
    filesystem?: FileSystemDialogueJournalConfig;
    redis?: any; // TODO: Add Redis configuration when implemented
}

/**
 * Factory for creating dialogue journal instances
 * Supports multiple backends with configuration-based selection
 */
export class DialogueJournalFactory {
    /**
     * Create a dialogue journal instance based on configuration
     */
    static create(config: DialogueJournalFactoryConfig): DialogueJournal {
        switch (config.backend) {
            case 'memory':
                if (!config.memory) {
                    throw new Error('Memory configuration required for memory backend');
                }
                return new VolatileMemoryDialogueJournal(config.memory);
            
            case 'filesystem':
                if (!config.filesystem) {
                    throw new Error('Filesystem configuration required for filesystem backend');
                }
                return new FileSystemDialogueJournal(config.filesystem);
            
            case 'redis':
                throw new Error('Redis backend not yet implemented');
            
            default:
                throw new Error(`Unsupported backend: ${config.backend}`);
        }
    }

    /**
     * Create a dialogue journal from environment variables
     */
    static createFromEnv(): DialogueJournal {
        const backend = (process.env.DIALOGUE_JOURNAL_BACKEND || 'filesystem') as DialogueJournalBackend;
        
        switch (backend) {
            case 'memory':
                return new VolatileMemoryDialogueJournal({
                    maxConversationLength: parseInt(process.env.DIALOGUE_JOURNAL_MAX_CONVERSATION_LENGTH || '100'),
                    maxConversationsPerUser: parseInt(process.env.DIALOGUE_JOURNAL_MAX_CONVERSATIONS_PER_USER || '10'),
                    maxConversationAgeHours: parseInt(process.env.DIALOGUE_JOURNAL_MAX_CONVERSATION_AGE_HOURS || '168'),
                    maxInactiveUserHours: parseInt(process.env.DIALOGUE_JOURNAL_MAX_INACTIVE_USER_HOURS || '720')
                });
            
            case 'filesystem':
                return new FileSystemDialogueJournal({
                    root: process.env.DIALOGUE_JOURNAL_ROOT || './data/dialogues',
                    maxConversationLength: parseInt(process.env.DIALOGUE_JOURNAL_MAX_CONVERSATION_LENGTH || '1000'),
                    maxConversationsPerUser: parseInt(process.env.DIALOGUE_JOURNAL_MAX_CONVERSATIONS_PER_USER || '50'),
                    archiveThreshold: parseInt(process.env.DIALOGUE_JOURNAL_ARCHIVE_THRESHOLD || '100'),
                    retentionDays: parseInt(process.env.DIALOGUE_JOURNAL_RETENTION_DAYS || '365'),
                    lockTimeoutMs: parseInt(process.env.DIALOGUE_JOURNAL_LOCK_TIMEOUT_MS || '5000'),
                    serverId: process.env.DIALOGUE_JOURNAL_SERVER_ID || `server-${Date.now()}`,
                    shardLevels: parseInt(process.env.DIALOGUE_JOURNAL_SHARD_LEVELS || '2'),
                    shardSize: parseInt(process.env.DIALOGUE_JOURNAL_SHARD_SIZE || '2')
                });
            
            case 'redis':
                throw new Error('Redis backend not yet implemented');
            
            default:
                throw new Error(`Unsupported backend: ${backend}`);
        }
    }

    /**
     * Create a dialogue journal from YAML configuration
     */
    static createFromConfig(config: any): DialogueJournal {
        const backend = config.dialogueJournal?.backend || 'filesystem';
        
        switch (backend) {
            case 'memory':
                return new VolatileMemoryDialogueJournal({
                    maxConversationLength: config.dialogueJournal?.memory?.maxConversationLength || 100,
                    maxConversationsPerUser: config.dialogueJournal?.memory?.maxConversationsPerUser || 10,
                    maxConversationAgeHours: config.dialogueJournal?.memory?.maxConversationAgeHours || 168,
                    maxInactiveUserHours: config.dialogueJournal?.memory?.maxInactiveUserHours || 720
                });
            
            case 'filesystem':
                return new FileSystemDialogueJournal({
                    root: config.dialogueJournal?.filesystem?.root || './data/dialogues',
                    maxConversationLength: config.dialogueJournal?.filesystem?.maxConversationLength || 1000,
                    maxConversationsPerUser: config.dialogueJournal?.filesystem?.maxConversationsPerUser || 50,
                    archiveThreshold: config.dialogueJournal?.filesystem?.archiveThreshold || 100,
                    retentionDays: config.dialogueJournal?.filesystem?.retentionDays || 365,
                    lockTimeoutMs: config.dialogueJournal?.filesystem?.lockTimeoutMs || 5000,
                    serverId: config.dialogueJournal?.filesystem?.serverId || `server-${Date.now()}`
                });
            
            case 'redis':
                throw new Error('Redis backend not yet implemented');
            
            default:
                throw new Error(`Unsupported backend: ${backend}`);
        }
    }
}
