/**
 * Shared type definitions for the workflow agent system.
 * These types define the contract between workflow and activities.
 */

// ============================================================================
// Input Types
// ============================================================================

/** Raw task input from the frontend */
export interface TaskInput {
  query: string;
}

// ============================================================================
// Intermediate Types (Activity Outputs)
// ============================================================================

/** Parsed task specification - output of parseTask activity */
export interface TaskSpec {
  query: string;
  keywords: string[];
  taskType: 'research' | 'summarize' | 'analyze';
}

/** Result from a single source - output of fetch activities */
export interface SourceResult {
  source: string;
  items: Array<{
    title: string;
    relevance: number;
  }>;
  fetchedAt: number;
}

// ============================================================================
// Output Types
// ============================================================================

/** Final workflow result */
export interface AgentResult {
  query: string;
  sources: SourceResult[];
  summary: string;
  errors?: string[];
  partial: boolean;
  completedAt: number;
}

// ============================================================================
// Error Types
// ============================================================================

/** Custom error for validation failures - marked as non-retryable */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Custom error for source fetch failures */
export class SourceFetchError extends Error {
  constructor(
    public readonly source: string,
    message: string
  ) {
    super(message);
    this.name = 'SourceFetchError';
  }
}
