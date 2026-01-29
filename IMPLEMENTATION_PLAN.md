# Implementation Plan: Temporal Workflow Agent

## Problem Statement (Restated)

Build a **minimal agent execution engine** using Temporal as the orchestration backbone. The system accepts tasks from a Next.js frontend, executes them via a Temporal workflow that coordinates multiple tool calls (activities), and returns structured results. This is a systems design exercise — the goal is to demonstrate correct Temporal usage, clear architectural reasoning, and sound engineering judgment, not to build a polished product.

**Core requirement**: Each tool invocation must be a separate Temporal activity. Workflow code must be deterministic. The frontend must trigger execution and display results.

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                          │
│  [Task Form] ──▶ [/api/execute] ──▶ [Status Display]           │
└──────────────────────┬─────────────────▲───────────────────────┘
                       │                 │ Poll via /api/status
                       │ Start workflow  │ (Temporal query)
                       ▼                 │
┌────────────────────────────────────────┴───────────────────────┐
│                    TEMPORAL SERVER                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   AgentWorkflow                           │  │
│  │  1. parseTask(input)    → TaskSpec                        │  │
│  │  2. [fetchSourceA, fetchSourceB] → SourceResult[]        │  │
│  │  3. synthesize(results) → AgentResult (pure function)     │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────────┐
│                    TEMPORAL WORKER                              │
│  Activities: parseTask | fetchSourceA | fetchSourceB           │
└────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Role |
|-----------|------|
| **Next.js API Routes** | Thin Temporal client wrapper. Starts workflow, queries status. No business logic. |
| **Temporal Workflow** | Orchestration only. Decides activity sequence, handles results. No I/O. |
| **Temporal Activities** | All side effects: network calls, external APIs, mocked LLM calls. |
| **Temporal Worker** | Hosts and executes workflow + activity code. |
| **Task Queue** | `agent-tasks` — single queue for this demo. |

---

## Temporal Design

### Primary Workflow: `agentWorkflow`

**Purpose**: Orchestrate a research task by coordinating three activities.

**Why one workflow?** The task is a single cohesive unit. Multiple workflows would add complexity without benefit. Child workflows are unnecessary for this scope.

```typescript
// Pseudocode structure
async function agentWorkflow(taskInput: string): Promise<AgentResult> {
  const taskSpec = await parseTask(taskInput);           // Step 1
  const [a, b] = await Promise.all([                     // Step 2 (parallel)
    fetchSourceA(taskSpec),
    fetchSourceB(taskSpec),
  ]);
  return synthesizeResults(taskSpec, a, b);              // Step 3 (pure)
}
```

### Activities

| Activity | Why It's an Activity | Retry Policy |
|----------|---------------------|--------------|
| `parseTask` | Represents external parsing (could be LLM/NLP service). Currently mocked, but the boundary is correct. | 2 attempts, no retry on `ValidationError` |
| `fetchSourceA` | Network I/O to external source. Non-deterministic, can fail. | 5 attempts, exponential backoff, heartbeat every 10s |
| `fetchSourceB` | Network I/O to different source. Same rationale. | 5 attempts, exponential backoff, heartbeat every 10s |

**Note**: `synthesizeResults` is a **pure function**, not an activity. It has no side effects, so it belongs in the workflow.

### Failure Handling

| Scenario | Handling |
|----------|----------|
| Parse failure (bad input) | Fail fast. Non-retryable error. User sees clear error message. |
| Single source fails | Use `Promise.allSettled` to return partial results with error flag. |
| All sources fail | Workflow fails. Frontend displays error state. |
| Worker crash mid-execution | Temporal automatically replays and resumes. |

### Timeout Configuration

```typescript
// Activities that talk to external services
startToCloseTimeout: '30s',  // Max time for single attempt
scheduleToCloseTimeout: '2m', // Max total time including retries

// Parse activity (should be fast)
startToCloseTimeout: '10s',
```

**Heartbeating**: Fetch activities heartbeat every 10s. This allows Temporal to detect stuck workers and reassign work if a worker dies mid-execution.

---

## Tradeoffs & Assumptions

| Decision | Why | Alternative Considered |
|----------|-----|------------------------|
| **Polling for status** | Simpler than WebSocket. Temporal queries work well. Fits time budget. | SSE/WebSocket (over-engineering) |
| **3 activities exactly** | Meets minimum requirement. Easy to extend. | More granular activities (unnecessary) |
| **Parallel fetch** | Demonstrates Temporal capability. More realistic. | Sequential (slower, no benefit) |
| **Mock implementations** | Explicitly allowed. Keeps focus on architecture. | Real APIs (out of scope) |
| **Single workflow type** | Task is cohesive. No need for child workflows. | Separate workflows (over-engineering) |
| **UUID workflow IDs** | Simple, no collisions. | Deterministic IDs (useful for idempotency, not required here) |

---

## Intentionally Out of Scope

Per assignment instructions, the following are **not implemented**:

- Authentication / Authorization
- Database persistence
- Real LLM integration
- Production deployment
- UI polish
- WebSocket real-time updates

---

## File Structure

```
temporal-workflow-agent/
├── temporal/
│   ├── src/
│   │   ├── workflows/
│   │   │   └── agentWorkflow.ts    # Workflow definition
│   │   ├── activities/
│   │   │   └── index.ts            # All activities
│   │   ├── types.ts                # Shared types
│   │   └── worker.ts               # Worker setup
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── execute/route.ts
│   │   │   │   └── status/[workflowId]/route.ts
│   │   │   └── page.tsx
│   │   └── components/
│   │       └── TaskExecutor.tsx
│   └── package.json
├── README.md
├── IMPLEMENTATION_PLAN.md
└── PROJECT_CONTEXT.md
```

---

## Implementation Order

1. **Types first** — Define `TaskSpec`, `SourceResult`, `AgentResult`
2. **Activities** — Implement all three with proper error handling
3. **Workflow** — Wire activities together with retry policies
4. **Worker** — Register workflow and activities
5. **API routes** — Start workflow, query status
6. **Frontend** — Minimal UI for input and display
7. **Testing** — Manual verification of happy path and failure cases
8. **README** — Document decisions and reasoning
