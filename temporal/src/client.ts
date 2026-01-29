/**
 * Temporal Client utility for starting and querying workflows.
 * Used by the Next.js API routes.
 */

import { Client, Connection } from '@temporalio/client';
import type { agentWorkflow } from './workflows/agentWorkflow.js';

// Singleton connection (reused across requests)
let client: Client | null = null;

const TASK_QUEUE = 'agent-tasks';
const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';

/**
 * Get or create a Temporal client connection.
 * Reuses connection across requests for efficiency.
 */
export async function getClient(): Promise<Client> {
  if (!client) {
    const connection = await Connection.connect({
      address: TEMPORAL_ADDRESS,
    });
    client = new Client({ connection });
  }
  return client;
}

/**
 * Start a new agent workflow execution.
 * 
 * @param taskInput - The user's task query
 * @returns Workflow ID for status tracking
 */
export async function startAgentWorkflow(taskInput: string): Promise<string> {
  const temporalClient = await getClient();

  const workflowId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await temporalClient.workflow.start('agentWorkflow', {
    taskQueue: TASK_QUEUE,
    workflowId,
    args: [taskInput],
  });

  return workflowId;
}

/**
 * Get the status and result of a workflow.
 */
export async function getWorkflowStatus(workflowId: string) {
  const temporalClient = await getClient();
  const handle = temporalClient.workflow.getHandle(workflowId);

  const description = await handle.describe();
  const status = description.status.name;

  let result = null;
  let error = null;

  if (status === 'COMPLETED') {
    result = await handle.result();
  } else if (status === 'FAILED') {
    try {
      await handle.result();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    }
  }

  return { workflowId, status, result, error };
}

export { TASK_QUEUE };
