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
  try {
    const body = await request.json();
    const taskInput = body.taskInput;

    if (!taskInput || typeof taskInput !== 'string') {
      return NextResponse.json(
        { error: 'taskInput is required and must be a string' },
        { status: 400 }
      );
    }

    const workflowId = await startWorkflow(taskInput);

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
