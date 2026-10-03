import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Worker } from '@temporalio/worker';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Context } from '@temporalio/activity';
import { ApplicationFailure, CancelledFailure } from '@temporalio/workflow';
import { WorkflowFailedError } from '@temporalio/client';
import { parseTask } from '../src/activities/index.js';
import type { TaskSpec } from '../src/types.js';

const source = (spec: TaskSpec) => ({ source: 'test', items: [{title: spec.query, relevance: 1}], fetchedAt: 1 });

test('rejects invalid activity input without accidental TypeErrors', async () => {
  for (const input of [null, 1, {}, '', '  ', 'ab']) {
    await assert.rejects(parseTask(input as string), { name: 'ValidationError' });
  }
  assert.equal((await parseTask('  research cats  ')).query, 'research cats');
});

test('real Temporal execution preserves partial failures and cancellation', { timeout: 120000 }, async () => {
  const env = await TestWorkflowEnvironment.createLocal();
  try {
    for (const mode of ['success', 'partial', 'cancel'] as const) {
      const taskQueue = `agent-test-${mode}`;
      let started!: () => void;
      const activityStarted = new Promise<void>(resolve => { started = resolve; });
      let activityCancelled = false;
      const worker = await Worker.create({
        connection: env.nativeConnection,
        taskQueue,
        workflowsPath: fileURLToPath(new URL('../src/workflows/agentWorkflow.ts', import.meta.url)),
        activities: {
          parseTask,
          fetchSourceA: async (spec: TaskSpec) => {
            if (mode === 'partial') throw ApplicationFailure.nonRetryable('source offline');
            if (mode === 'cancel') {
              Context.current().heartbeat();
              started();
              const context = Context.current();
              const heartbeat = setInterval(() => context.heartbeat(), 200);
              try { await context.sleep(60000); }
              catch (error) { activityCancelled = true; throw error; }
              finally { clearInterval(heartbeat); }
            }
            return source(spec);
          },
          fetchSourceB: async (spec: TaskSpec) => source(spec),
        },
      });
      await worker.runUntil(async () => {
        const handle = await env.client.workflow.start('agentWorkflow', {
          taskQueue, workflowId: `agent-${mode}`, args: ['research cats'],
        });
        if (mode === 'cancel') {
          await activityStarted;
          await handle.cancel();
          await assert.rejects(handle.result(), error => error instanceof WorkflowFailedError && error.cause instanceof CancelledFailure);
          assert.equal((await handle.describe()).status.name, 'CANCELLED');
          assert.equal(activityCancelled, true);
        } else {
          const result = await handle.result();
          assert.equal(result.partial, mode === 'partial');
          assert.equal(result.sources.length, mode === 'partial' ? 1 : 2);
          if (mode === 'partial') assert.equal(result.errors.length, 1);
        }
      });
    }
  } finally { await env.teardown(); }
});
