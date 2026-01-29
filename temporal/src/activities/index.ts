/**
 * Activity implementations for the workflow agent.
 * 
 * DESIGN NOTE: Each activity represents a side-effect boundary.
 * - parseTask: Could call external NLP/LLM service (mocked)
 * - fetchSourceA/B: Network I/O to external data sources (mocked)
 * 
 * Activities are independently retryable and isolated from workflow logic.
 */

import { Context } from '@temporalio/activity';
import type { TaskSpec, SourceResult } from '../types.js';
import { ValidationError } from '../types.js';

// ============================================================================
// Parse Task Activity
// ============================================================================

/**
 * Parses raw task input into a structured TaskSpec.
 * 
 * In production: Would call an LLM or NLP service.
 * For this demo: Deterministic parsing with basic validation.
 * 
 * Retry policy: 2 attempts, no retry on ValidationError
 */
export async function parseTask(input: string): Promise<TaskSpec> {
  // Validate input
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ValidationError('Task input cannot be empty');
  }
  if (trimmed.length < 3) {
    throw new ValidationError('Task input too short (minimum 3 characters)');
  }

  // TODO: Replace with actual parsing logic
  // For now: extract keywords and infer task type
  const keywords = trimmed
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3);

  const taskType = inferTaskType(trimmed);

  return {
    query: trimmed,
    keywords,
    taskType,
  };
}

/** Simple task type inference based on keywords */
function inferTaskType(input: string): TaskSpec['taskType'] {
  const lower = input.toLowerCase();
  if (lower.includes('summarize') || lower.includes('summary')) return 'summarize';
  if (lower.includes('analyze') || lower.includes('analysis')) return 'analyze';
  return 'research';
}

// ============================================================================
// Fetch Source A Activity
// ============================================================================

/**
 * Fetches data from Source A (e.g., internal database).
 * 
 * In production: Would make actual API/database calls.
 * For this demo: Returns mock data with simulated latency.
 * 
 * Retry policy: 5 attempts, exponential backoff, heartbeat every 10s
 */
export async function fetchSourceA(spec: TaskSpec): Promise<SourceResult> {
  // Heartbeat for long-running operations
  Context.current().heartbeat('Starting fetch from Source A');

  // TODO: Replace with actual data source fetch
  await simulateNetworkDelay(500, 1500);

  // Simulate occasional transient failure (10% chance)
  if (Math.random() < 0.1) {
    throw new Error('Source A temporarily unavailable');
  }

  Context.current().heartbeat('Processing results from Source A');

  return {
    source: 'database-alpha',
    items: spec.keywords.slice(0, 3).map((kw, i) => ({
      title: `Result for "${kw}" from Alpha`,
      relevance: 0.9 - i * 0.1,
    })),
    fetchedAt: Date.now(),
  };
}

// ============================================================================
// Fetch Source B Activity
// ============================================================================

/**
 * Fetches data from Source B (e.g., external API).
 * 
 * In production: Would make actual API calls with auth.
 * For this demo: Returns mock data with simulated latency.
 * 
 * Retry policy: 5 attempts, exponential backoff, heartbeat every 10s
 */
export async function fetchSourceB(spec: TaskSpec): Promise<SourceResult> {
  Context.current().heartbeat('Starting fetch from Source B');

  // TODO: Replace with actual API fetch
  await simulateNetworkDelay(300, 1000);

  Context.current().heartbeat('Processing results from Source B');

  return {
    source: 'api-beta',
    items: spec.keywords.slice(0, 2).map((kw, i) => ({
      title: `${spec.taskType} result for "${kw}" from Beta`,
      relevance: 0.85 - i * 0.15,
    })),
    fetchedAt: Date.now(),
  };
}

// ============================================================================
// Helpers (not exported as activities)
// ============================================================================

/** Simulates network latency for demo purposes */
function simulateNetworkDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs) + minMs);
  return new Promise((resolve) => setTimeout(resolve, delay));
}
