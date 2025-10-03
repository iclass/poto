/**
 * Type definitions for the clean RPC approach
 * Define your interfaces once, use them everywhere with full type safety
 */

// // Parent window API interface
// export interface ParentAPI {
//   getParentInfo(): Promise<ParentInfo>;
//   showNotification(message: string, type: 'success' | 'error' | 'warning' | 'info'): Promise<void>;
//   getUserPreferences(): Promise<UserPreferences>;
//   triggerParentAction(action: string): Promise<any>;
// }

// // Server API interface
// export interface ServerAPI {
//   getServerInfo(): Promise<ServerInfo>;
//   processData(data: any): Promise<ProcessedData>;
//   echo(message: string): Promise<EchoResponse>;
//   getStats(): Promise<ServerStats>;
//   testMethod(param1: string, param2: number, param3: boolean): Promise<TestResult>;
// }

export const DEMO_BASE = 'RPC_DEMO'

// Response types
export interface ParentInfo {
  windowId: string;
  url: string;
  title: string;
  timestamp: number;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  notifications: boolean;
}

export interface ServerInfo {
  serverName: string;
  timestamp: number;
  uptime: number;
  version: string;
  features: string[];
}

export interface ProcessedData {
  processed: boolean;
  receivedAt: number;
  dataSize: number;
  message: string;
  echo: any;
}

export interface EchoResponse {
  original: string;
  echoed: string;
  timestamp: number;
}

export interface ServerStats {
  requests: number;
  memory: NodeJS.MemoryUsage;
  platform: string;
  nodeVersion: string;
}

export interface TestResult {
  param1: string;
  param2: number;
  param3: boolean;
  result: string;
  timestamp: number;
} 