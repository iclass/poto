import { TokenUsage } from '../server/CompletionResponse';

/**
 * Tracks token usage for a single LLM session
 */
export class LLMSessionTracker {
    private sessionId: string;
    private startTime: Date;
    private endTime?: Date;
    private totalUsage: TokenUsage;
    private requestCount: number;
    private requests: Array<{
        timestamp: Date;
        usage: TokenUsage;
        model: string;
        maxTokens: number;
        actualTokens: number;
    }>;

    constructor(sessionId: string) {
        this.sessionId = sessionId;
        this.startTime = new Date();
        this.totalUsage = new TokenUsage();
        this.requestCount = 0;
        this.requests = [];
    }

    /**
     * Record a token usage for this session
     */
    recordUsage(usage: TokenUsage, model: string, maxTokens: number): void {
        this.totalUsage.add(usage);
        this.requestCount++;
        this.requests.push({
            timestamp: new Date(),
            usage: new TokenUsage(usage),
            model,
            maxTokens,
            actualTokens: usage.total_tokens
        });
    }

    /**
     * End the session
     */
    endSession(): void {
        this.endTime = new Date();
    }

    /**
     * Get session duration in milliseconds
     */
    getDuration(): number {
        const end = this.endTime || new Date();
        return end.getTime() - this.startTime.getTime();
    }

    /**
     * Get session duration in a human-readable format
     */
    getDurationFormatted(): string {
        const duration = this.getDuration();
        const seconds = Math.floor(duration / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Get average tokens per request
     */
    getAverageTokensPerRequest(): number {
        return this.requestCount > 0 ? Math.round(this.totalUsage.total_tokens / this.requestCount) : 0;
    }

    /**
     * Get average tokens per minute
     */
    getTokensPerMinute(): number {
        const durationMinutes = this.getDuration() / (1000 * 60);
        return durationMinutes > 0 ? Math.round(this.totalUsage.total_tokens / durationMinutes) : 0;
    }

    /**
     * Get efficiency ratio (actual tokens used vs max tokens requested)
     */
    getEfficiencyRatio(): number {
        const totalMaxTokens = this.requests.reduce((sum, req) => sum + req.maxTokens, 0);
        return totalMaxTokens > 0 ? this.totalUsage.total_tokens / totalMaxTokens : 0;
    }

    /**
     * Get session summary
     */
    getSummary(): {
        sessionId: string;
        duration: string;
        requestCount: number;
        totalTokens: number;
        promptTokens: number;
        completionTokens: number;
        averageTokensPerRequest: number;
        tokensPerMinute: number;
        efficiencyRatio: number;
        startTime: Date;
        endTime?: Date;
    } {
        return {
            sessionId: this.sessionId,
            duration: this.getDurationFormatted(),
            requestCount: this.requestCount,
            totalTokens: this.totalUsage.total_tokens,
            promptTokens: this.totalUsage.prompt_tokens,
            completionTokens: this.totalUsage.completion_tokens,
            averageTokensPerRequest: this.getAverageTokensPerRequest(),
            tokensPerMinute: this.getTokensPerMinute(),
            efficiencyRatio: this.getEfficiencyRatio(),
            startTime: this.startTime,
            endTime: this.endTime
        };
    }

    /**
     * Get detailed request breakdown
     */
    getRequestBreakdown(): Array<{
        timestamp: Date;
        model: string;
        maxTokens: number;
        actualTokens: number;
        promptTokens: number;
        completionTokens: number;
        efficiency: number;
    }> {
        return this.requests.map(req => ({
            timestamp: req.timestamp,
            model: req.model,
            maxTokens: req.maxTokens,
            actualTokens: req.usage.total_tokens,
            promptTokens: req.usage.prompt_tokens,
            completionTokens: req.usage.completion_tokens,
            efficiency: req.maxTokens > 0 ? req.usage.total_tokens / req.maxTokens : 0
        }));
    }
}

/**
 * Manages multiple LLM sessions for batch processing
 */
export class LLMBatchTracker {
    private sessions: Map<string, LLMSessionTracker>;
    private currentSessionId?: string;
    private batchStartTime: Date;
    private batchEndTime?: Date;

    constructor() {
        this.sessions = new Map();
        this.batchStartTime = new Date();
    }

    /**
     * Start a new session
     */
    startSession(sessionId: string): LLMSessionTracker {
        const session = new LLMSessionTracker(sessionId);
        this.sessions.set(sessionId, session);
        this.currentSessionId = sessionId;
        return session;
    }

    /**
     * Get the current session
     */
    getCurrentSession(): LLMSessionTracker | undefined {
        return this.currentSessionId ? this.sessions.get(this.currentSessionId) : undefined;
    }

    /**
     * End the current session
     */
    endCurrentSession(): void {
        if (this.currentSessionId) {
            const session = this.sessions.get(this.currentSessionId);
            if (session) {
                session.endSession();
            }
            this.currentSessionId = undefined;
        }
    }

    /**
     * End the entire batch
     */
    endBatch(): void {
        this.batchEndTime = new Date();
        // End all active sessions
        for (const session of this.sessions.values()) {
            if (!session.getSummary().endTime) {
                session.endSession();
            }
        }
    }

    /**
     * Get batch summary
     */
    getBatchSummary(): {
        batchDuration: string;
        totalSessions: number;
        totalRequests: number;
        totalTokens: number;
        totalPromptTokens: number;
        totalCompletionTokens: number;
        averageTokensPerRequest: number;
        averageTokensPerSession: number;
        tokensPerMinute: number;
        startTime: Date;
        endTime?: Date;
        sessions: Array<ReturnType<LLMSessionTracker['getSummary']>>;
    } {
        const sessions = Array.from(this.sessions.values());
        const totalRequests = sessions.reduce((sum, session) => sum + session.getSummary().requestCount, 0);
        const totalTokens = sessions.reduce((sum, session) => sum + session.getSummary().totalTokens, 0);
        const totalPromptTokens = sessions.reduce((sum, session) => sum + session.getSummary().promptTokens, 0);
        const totalCompletionTokens = sessions.reduce((sum, session) => sum + session.getSummary().completionTokens, 0);
        
        const batchDuration = this.batchEndTime ? 
            this.batchEndTime.getTime() - this.batchStartTime.getTime() : 
            new Date().getTime() - this.batchStartTime.getTime();
        
        const durationMinutes = batchDuration / (1000 * 60);
        const tokensPerMinute = durationMinutes > 0 ? Math.round(totalTokens / durationMinutes) : 0;

        return {
            batchDuration: this.formatDuration(batchDuration),
            totalSessions: sessions.length,
            totalRequests,
            totalTokens,
            totalPromptTokens,
            totalCompletionTokens,
            averageTokensPerRequest: totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0,
            averageTokensPerSession: sessions.length > 0 ? Math.round(totalTokens / sessions.length) : 0,
            tokensPerMinute,
            startTime: this.batchStartTime,
            endTime: this.batchEndTime,
            sessions: sessions.map(session => session.getSummary())
        };
    }

    /**
     * Format duration in milliseconds to human-readable format
     */
    private formatDuration(durationMs: number): string {
        const seconds = Math.floor(durationMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Generate a detailed report
     */
    generateReport(): string {
        const summary = this.getBatchSummary();
        
        let report = `
# LLM Batch Token Usage Report

## Batch Summary
- **Duration**: ${summary.batchDuration}
- **Total Sessions**: ${summary.totalSessions}
- **Total Requests**: ${summary.totalRequests}
- **Total Tokens**: ${summary.totalTokens.toLocaleString()}
- **Prompt Tokens**: ${summary.totalPromptTokens.toLocaleString()}
- **Completion Tokens**: ${summary.totalCompletionTokens.toLocaleString()}
- **Average Tokens/Request**: ${summary.averageTokensPerRequest}
- **Average Tokens/Session**: ${summary.averageTokensPerSession}
- **Tokens/Minute**: ${summary.tokensPerMinute}

## Session Breakdown
`;

        summary.sessions.forEach((session, index) => {
            report += `
### Session ${index + 1}: ${session.sessionId}
- **Duration**: ${session.duration}
- **Requests**: ${session.requestCount}
- **Total Tokens**: ${session.totalTokens.toLocaleString()}
- **Prompt Tokens**: ${session.promptTokens.toLocaleString()}
- **Completion Tokens**: ${session.completionTokens.toLocaleString()}
- **Average Tokens/Request**: ${session.averageTokensPerRequest}
- **Tokens/Minute**: ${session.tokensPerMinute}
- **Efficiency Ratio**: ${(session.efficiencyRatio * 100).toFixed(1)}%
`;
        });

        return report;
    }
}
