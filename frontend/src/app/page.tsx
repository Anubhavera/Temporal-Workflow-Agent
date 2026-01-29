/**
 * Main Page - Minimal UI for workflow execution
 * 
 * WHY THIS IS INTENTIONALLY MINIMAL:
 * This is a systems architecture exercise, not a UI challenge. The frontend
 * exists only to demonstrate the integration with Temporal. All business logic,
 * orchestration, retries, and failure handling live in the Temporal workflow.
 * 
 * The frontend is a thin client that:
 * 1. Submits a task (POST /api/execute)
 * 2. Polls for status (GET /api/status/[id])
 * 3. Displays the result
 * 
 * FUTURE IMPROVEMENTS (not implemented):
 * - WebSocket/SSE for real-time updates instead of polling
 * - Better error display with retry options
 * - Execution history list
 */

'use client';

import { useState } from 'react';

type WorkflowStatus = {
  workflowId: string;
  status: string;
  result?: {
    query: string;
    sources: Array<{ source: string; items: Array<{ title: string; relevance: number }> }>;
    summary: string;
    errors?: string[];
    partial: boolean;
  };
  error?: string;
};

export default function Home() {
  const [taskInput, setTaskInput] = useState('');
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkflowStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Submit task and start workflow
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskInput }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start workflow');
      }

      const { workflowId } = await res.json();
      setWorkflowId(workflowId);

      // Start polling for status
      pollStatus(workflowId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }

  // Poll for workflow status until complete or failed
  async function pollStatus(id: string) {
    const poll = async () => {
      try {
        const res = await fetch(`/api/status/${id}`);
        const data: WorkflowStatus = await res.json();
        setStatus(data);

        // Continue polling if still running
        if (data.status === 'RUNNING') {
          setTimeout(poll, 1000); // Poll every 1 second
        } else {
          setLoading(false);
        }
      } catch (err) {
        setError('Failed to fetch status');
        setLoading(false);
      }
    };

    poll();
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '800px' }}>
      <h1>Workflow Agent</h1>
      <p>Submit a task to execute via Temporal workflow.</p>

      {/* Task Input Form */}
      <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
        <input
          type="text"
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          placeholder="Enter a task (e.g., 'research temporal workflows')"
          style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !taskInput.trim()}
          style={{ marginTop: '0.5rem', padding: '0.5rem 1rem' }}
        >
          {loading ? 'Running...' : 'Execute'}
        </button>
      </form>

      {/* Error Display */}
      {error && (
        <div style={{ marginTop: '1rem', color: 'red' }}>
          Error: {error}
        </div>
      )}

      {/* Workflow ID */}
      {workflowId && (
        <div style={{ marginTop: '1rem' }}>
          <strong>Workflow ID:</strong> <code>{workflowId}</code>
        </div>
      )}

      {/* Status Display */}
      {status && (
        <div style={{ marginTop: '1rem' }}>
          <strong>Status:</strong> {status.status}

          {status.status === 'COMPLETED' && status.result && (
            <div style={{ marginTop: '1rem', background: '#f5f5f5', padding: '1rem' }}>
              <h3>Result</h3>
              <p><strong>Query:</strong> {status.result.query}</p>
              <p><strong>Summary:</strong> {status.result.summary}</p>

              {status.result.partial && (
                <p style={{ color: 'orange' }}>⚠️ Partial results (some sources failed)</p>
              )}

              {status.result.errors && status.result.errors.length > 0 && (
                <div>
                  <strong>Errors:</strong>
                  <ul>
                    {status.result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <h4>Sources</h4>
              {status.result.sources.map((source, i) => (
                <div key={i} style={{ marginLeft: '1rem' }}>
                  <strong>{source.source}</strong>
                  <ul>
                    {source.items.map((item, j) => (
                      <li key={j}>{item.title} (relevance: {item.relevance.toFixed(2)})</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {status.status === 'FAILED' && (
            <div style={{ marginTop: '1rem', color: 'red' }}>
              <strong>Workflow failed:</strong> {status.error}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
