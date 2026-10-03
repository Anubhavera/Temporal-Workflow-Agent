/**
 * Agent Workflow - Orchestrates task execution through multiple activities.
 * 
 * DESIGN NOTES:
 * - Deterministic orchestration: no I/O; workflow time comes from Temporal's sandbox
 * - All side effects are delegated to activities
 * - Uses Promise.allSettled for graceful partial failure handling
 * - Synthesis is a pure function (not an activity) because it has no side effects
 */

import { proxyActivities, ApplicationFailure, isCancellation, ActivityCancellationType, CancellationScope, CancelledFailure } from '@temporalio/workflow';
import type * as activities from '../activities/index.js';
import type { AgentResult, SourceResult, TaskSpec } from '../types.js';

// ============================================================================
// Activity Proxies with Retry Policies
// ============================================================================

/**
 * Parse activity: fail fast on validation errors.
 * - 2 attempts max (bad input won't fix itself)
 * - ValidationError is non-retryable
 */
const { parseTask } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10s',
  retry: {
    maximumAttempts: 2,
    nonRetryableErrorTypes: ['ValidationError'],
  },
});

/**
 * Fetch activities: retry aggressively for transient failures.
 * - 5 attempts with exponential backoff
 * - Heartbeat timeout to detect stuck workers
 */
const { fetchSourceA, fetchSourceB } = proxyActivities<typeof activities>({
  startToCloseTimeout: '30s',
  scheduleToCloseTimeout: '2m',
  heartbeatTimeout: '15s',
  cancellationType: ActivityCancellationType.WAIT_CANCELLATION_COMPLETED,
  retry: {
    maximumAttempts: 5,
    initialInterval: '500ms',
    backoffCoefficient: 2,
    maximumInterval: '30s',
  },
});

// ============================================================================
// Main Workflow
// ============================================================================

/**
 * Orchestrates a research task by:
 * 1. Parsing the input into a structured spec
 * 2. Fetching data from multiple sources in parallel
 * 3. Synthesizing all results into a final output
 * 
 * @param taskInput - Raw task string from the user
 * @returns AgentResult with sources, summary, and any errors
 */
export async function agentWorkflow(taskInput: string): Promise<AgentResult> {
  // Step 1: Parse task (may throw ValidationError - non-retryable)
  const taskSpec = await parseTask(taskInput);

  // Step 2: Fetch from sources in parallel with graceful degradation
  const results = await Promise.allSettled([
    fetchSourceA(taskSpec),
    fetchSourceB(taskSpec),
  ]);

  if (CancellationScope.current().consideredCancelled) throw new CancelledFailure("Workflow cancelled");

  // Extract successful results and errors
  const successfulResults: SourceResult[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      successfulResults.push(result.value);
    } else {
      // Extract error message, handling Temporal's ApplicationFailure
      const error = result.reason;
      if (isCancellation(error)) throw error;
      const message = error instanceof ApplicationFailure
        ? error.message
        : error?.message ?? 'Unknown error';
      errors.push(message);
    }
  }

  // Step 3: Synthesize results (pure function - no activity needed)
  return synthesizeResults(taskSpec, successfulResults, errors);
}

// ============================================================================
// Pure Functions (safe in workflow - no side effects)
// ============================================================================

/**
 * Synthesizes multiple source results into a final output.
 * 
 * This is a PURE FUNCTION, not an activity, because:
 * - No I/O operations
 * - No external state
 * - Deterministic given the same inputs
 * 
 * Making this an activity would add unnecessary latency.
 */
function synthesizeResults(
  spec: TaskSpec,
  sources: SourceResult[],
  errors: string[]
): AgentResult {
  const totalItems = sources.reduce((sum, s) => sum + s.items.length, 0);

  // Build summary based on what we got
  let summary: string;
  if (sources.length === 0) {
    summary = 'No sources returned results.';
  } else if (errors.length > 0) {
    summary = `Partial results: Found ${totalItems} items from ${sources.length} source(s). Some sources failed.`;
  } else {
    summary = `Complete results: Found ${totalItems} items from ${sources.length} sources for "${spec.query}".`;
  }

  return {
    query: spec.query,
    sources,
    summary,
    errors: errors.length > 0 ? errors : undefined,
    partial: errors.length > 0,
    // Temporal's sandbox supplies replay-safe workflow time.
    completedAt: Date.now(),
  };
}
