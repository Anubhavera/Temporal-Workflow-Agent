/**
 * POST /api/execute
 * 
 * Starts a new agent workflow. This is a thin adapter — all business logic
 * lives in the Temporal workflow, not here.
 * 
 * Request: { taskInput: string }
 * Response: { workflowId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { startWorkflow } from '@/lib/temporal';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }
  const taskInput = body && typeof body === 'object' && 'taskInput' in body ? body.taskInput : undefined;

  if (typeof taskInput !== 'string' || taskInput.trim().length < 3) {
    return NextResponse.json({ error: 'taskInput must be a string of at least 3 characters' }, { status: 400 });
  }

  try {

    const workflowId = await startWorkflow(taskInput.trim());

    return NextResponse.json({ workflowId });
  } catch (error) {
    // Log for debugging, return generic error to client
    console.error('Failed to start workflow:', error);
    return NextResponse.json(
      { error: 'Failed to start workflow' },
      { status: 500 }
    );
  }
}
