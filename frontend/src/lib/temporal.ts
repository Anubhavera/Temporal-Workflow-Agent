/**
 * Temporal Client - Thin adapter for API routes.
 * 
 * This is intentionally duplicated from temporal/src/client.ts rather than
 * sharing code, because:
 * 1. Frontend and worker have different deployment contexts
 * 2. Avoids cross-package import complexity
 * 3. Simpler for a take-home assignment
 */

import { Client, Connection } from '@temporalio/client';

const TASK_QUEUE = 'agent-tasks';
const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';

let client: Client | null = null;

async function getClient(): Promise<Client> {
  if (!client) {
    const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
    client = new Client({ connection });
  }
  return client;
}

export async function startWorkflow(taskInput: string): Promise<string> {
  const temporalClient = await getClient();
  const workflowId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await temporalClient.workflow.start('agentWorkflow', {
    taskQueue: TASK_QUEUE,
    workflowId,
    args: [taskInput],
  });

  return workflowId;
}

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
