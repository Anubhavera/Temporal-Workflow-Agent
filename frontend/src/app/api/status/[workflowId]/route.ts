/**
 * GET /api/status/[workflowId]
 * 
 * Fetches the current status of a workflow. This is a thin adapter —
 * Temporal handles all state management.
 * 
 * Response: { workflowId, status, result?, error? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowStatus } from '@/lib/temporal';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await params;

    if (!workflowId) {
      return NextResponse.json(
        { error: 'workflowId is required' },
        { status: 400 }
      );
    }

    const status = await getWorkflowStatus(workflowId);

    return NextResponse.json(status);
  } catch (error) {
    console.error('Failed to get workflow status:', error);
    return NextResponse.json(
      { error: 'Failed to get workflow status' },
      { status: 500 }
    );
  }
}
