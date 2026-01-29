/**
 * Temporal Worker Configuration
 * 
 * This worker hosts both the workflow and all activities.
 * Task queue: 'agent-tasks' (single queue for this demo)
 * 
 * In production, you might:
 * - Run separate workers for workflows vs activities
 * - Use different task queues for different activity types
 * - Scale workers horizontally based on load
 */

import { Worker } from '@temporalio/worker';
import { fileURLToPath } from 'url';
import path from 'path';
import * as activities from './activities/index.js';

// Task queue name - matches what the client will use
const TASK_QUEUE = 'agent-tasks';

async function run() {
  // Resolve __dirname equivalent for ESM
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Create worker with workflow and activity registration
  const worker = await Worker.create({
    // Workflows are loaded from a separate bundle for isolation
    // Path to TypeScript source - Temporal's bundler handles compilation
    workflowsPath: path.join(__dirname, 'workflows', 'agentWorkflow.ts'),

    // Activities are registered directly
    activities,

    // Task queue this worker listens on
    taskQueue: TASK_QUEUE,

    // Optional: Configure worker behavior
    // maxConcurrentActivityTaskExecutions: 10,
    // maxConcurrentWorkflowTaskExecutions: 10,
  });

  console.log(`🚀 Worker started, listening on task queue: ${TASK_QUEUE}`);
  console.log('   Registered workflow: agentWorkflow');
  console.log('   Registered activities: parseTask, fetchSourceA, fetchSourceB');
  console.log('');
  console.log('Waiting for tasks... (Ctrl+C to stop)');

  // Run until interrupted
  await worker.run();
}

// Start the worker
run().catch((err) => {
  console.error('❌ Worker failed to start:', err);
  process.exit(1);
});
