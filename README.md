# Workflow Agent (Temporal-Backed)

A minimal agent execution engine demonstrating correct Temporal usage for workflow orchestration.

---

## Quick Start

```bash
# Prerequisites: Node.js 18+, pnpm

# 1. Start Temporal (in separate terminal)
temporal server start-dev

# 2. Start the worker
cd temporal && pnpm install && pnpm dev

# 3. Start the frontend
cd frontend && pnpm install && pnpm dev

# 4. Open http://localhost:3000
```

---

## Architecture Overview

```
Frontend (Next.js) ──▶ Temporal Server ──▶ Worker
     │                      │                │
     │ POST /api/execute    │                │
     │ GET /api/status/:id  │                │
     ▼                      ▼                ▼
  Start Workflow      AgentWorkflow      Activities
  Query Status        (orchestration)    (side effects)
```

The system follows a clear separation of concerns:

- **Frontend**: User interface only. No business logic.
- **API Routes**: Thin Temporal client wrapper. Starts workflows, queries status.
- **Workflow**: Pure orchestration. Decides what activities run and in what order.
- **Activities**: All side effects live here. Network calls, external APIs, etc.
- **Task Queue**: `agent-tasks` — single queue for all work. Separate queues per activity type would allow independent scaling in production.

---

## Design Decisions

### Why This Workflow/Activity Split?

| Code | Location | Reasoning |
|------|----------|-----------|
| Orchestration sequence | Workflow | Core purpose of Temporal workflows |
| Parallel coordination | Workflow | `Promise.all()` is safe; Temporal handles it |
| Pure data transformation | Workflow | No side effects = safe and deterministic |
| Network I/O | Activity | Non-deterministic, needs retry handling |
| External service calls | Activity | Must be isolated for replay safety |

**Key insight**: Workflows must be deterministic because Temporal replays them during recovery. Any non-deterministic operation (I/O, random, time) must be an activity.

### Why Three Activities?

```typescript
parseTask(input)     // Could call external NLP/LLM service
fetchSourceA(spec)   // Network I/O to source A
fetchSourceB(spec)   // Network I/O to source B
```

Each represents a distinct side-effect boundary. They are independently retryable and testable. The synthesis step is a pure function inside the workflow — no side effects, so making it an activity would add latency without retry benefit.

**Why not child workflows?** Child workflows would be appropriate if: (1) sub-tasks need independent retry budgets, (2) sub-tasks are reusable across workflows, or (3) event history would exceed ~50K events. None apply here.

### Retry Strategy

```typescript
// Network activities: retry aggressively
{
  maximumAttempts: 5,
  initialInterval: '500ms',
  backoffCoefficient: 2,
}

// Parse activity: fail fast
{
  maximumAttempts: 2,
  nonRetryableErrorTypes: ['ValidationError'],
}
```

**Why different policies?** Network failures are often transient and benefit from retries. Parse errors (bad input) won't fix themselves — retrying wastes time.

### Failure Handling

The workflow uses `Promise.allSettled` for graceful degradation:

```typescript
const results = await Promise.allSettled([fetchSourceA(spec), fetchSourceB(spec)]);
// Return partial results if one source fails
// Include error information for transparency
```

**Tradeoff**: More resilient, but frontend must handle incomplete data. I chose resilience because partial results are often better than total failure.

---

## Determinism in Practice

Workflows must be deterministic for Temporal's replay mechanism. Here's what that means:

| ❌ Forbidden in Workflows | ✅ Safe Alternatives |
|---------------------------|---------------------|
| `Math.random()` | Use activity or workflow.random() |
| `Date.now()` | Use `workflow.now()` |
| `fetch()` / HTTP calls | Move to activity |
| `fs.readFile()` | Move to activity |
| Global mutable state | Pass state through workflow arguments |

The workflow in this project only contains:
- Activity calls (via `proxyActivities`)
- Pure JavaScript logic
- `Promise.all()` for parallel coordination

### Cancellation Handling

The workflow respects Temporal cancellation. If cancelled, in-flight activities complete (no orphaned work), no new activities start, and the workflow returns a cancellation error.

---

## What I Would Change for Production

| Current State | Production Change |
|---------------|-------------------|
| Polling for status | WebSocket/SSE for real-time updates |
| Mock activities | Real API integrations with proper auth |
| Single worker | Horizontal scaling with multiple workers |
| No persistence | PostgreSQL for task history and audit logs |
| UUID workflow IDs | Deterministic IDs for idempotency |
| No observability | Prometheus metrics, structured logging |

---

## Extension Points

**Adding a new tool:**
1. Create new activity in `activities/index.ts`
2. Add to `proxyActivities` in workflow
3. Call from workflow with appropriate retry policy

**Supporting multi-step agent loops:**
```typescript
// Workflow could iterate based on LLM decisions
while (!complete) {
  const decision = await planNextStep(context);
  const result = await executeStep(decision);
  context = updateContext(context, result);
  complete = isComplete(context);
}
```

**MCP tool integration:**
Activities are natural integration points for MCP tools. Each MCP tool call would be wrapped in an activity with appropriate timeout and retry handling.

---

## Project Structure

```
temporal/
├── src/
│   ├── workflows/agentWorkflow.ts  # Orchestration logic
│   ├── activities/index.ts         # Side-effect implementations
│   ├── types.ts                    # Shared type definitions
│   └── worker.ts                   # Worker configuration
frontend/
├── src/app/
│   ├── api/execute/route.ts        # Start workflow endpoint
│   ├── api/status/[id]/route.ts    # Query status endpoint
│   └── page.tsx                    # Task submission UI
```

---

## Time Spent

- Architecture & Planning: ~2 hours
- Temporal Core (workflow + activities + worker): ~3 hours
- Frontend (API routes + UI): ~2 hours
- Testing & Documentation: ~2 hours

---

## Assumptions Made

1. **Task type**: Implemented a "research agent" that fetches from multiple sources. This demonstrates the orchestration pattern without requiring real LLM integration.

2. **Status updates**: Used polling with Temporal queries. WebSocket would be better for UX but adds complexity beyond the time budget.

3. **Error granularity**: Activities throw typed errors. The workflow catches and handles them explicitly rather than relying on default behavior.

4. **Single workflow**: The task is cohesive enough that child workflows aren't necessary. One workflow with multiple activities is sufficient.
