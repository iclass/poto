/**
 * Browser-compatible type declarations
 * These provide minimal type definitions for Node.js globals that are
 * conditionally used in browser-compatible code.
 */

declare global {
  // Minimal process type for browser compatibility
  const process: {
    env: Record<string, string | undefined>;
    versions?: {
      node?: string;
      bun?: string;
    };
  } | undefined;

  // Minimal Buffer type for browser compatibility
  const Buffer: {
    from(data: any, encoding?: string): {
      toString(encoding: string): string;
      buffer: ArrayBuffer;
      byteOffset: number;
      byteLength: number;
    };
  } | undefined;
}

export {};
