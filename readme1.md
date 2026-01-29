# Temporal Workflow Agent

A minimal agent execution engine demonstrating correct Temporal usage for workflow orchestration. This submission prioritizes architectural clarity and engineering judgment over feature completeness.

---

## System Architecture

```
Frontend (Next.js)        Temporal Server          Worker
       │                        │                    │
       │ POST /api/execute      │                    │
       ├───────────────────────►│                    │
       │                        │  AgentWorkflow     │
       │                        ├───────────────────►│
       │                        │                    │ Activities
       │ GET /api/status/:id    │                    │ (side effects)
       ◄────────────────────────┤◄───────────────────┤
       │ Query result           │                    │
```

**Component Responsibilities:**

| Component | Responsibility |
|-----------|----------------|
| Next.js API Routes | Thin Temporal client wrapper. Starts workflows, queries status. No business logic. |
| Temporal Workflow | Pure orchestration. Determines activity sequence, coordinates parallel execution, handles results. No I/O. |
| Temporal Activities | All side effects. Network calls, external service integration, mocked tool invocations. |
| Task Queue | `agent-tasks` — single queue for this scope. Production would use per-activity queues for independent scaling. |

---

## Key Technical Decisions

### Workflow/Activity Boundary

The fundamental Temporal constraint is workflow determinism: workflows are replayed during recovery, so any non-deterministic operation must be isolated in an activity.

| Location | Code Type | Rationale |
|----------|-----------|-----------|
| Workflow | Orchestration sequence | Core Temporal pattern |
| Workflow | `Promise.all()` coordination | Deterministic; Temporal handles parallelism |
| Workflow | Pure data transformation | No side effects, safe for replay |
| Activity | Network I/O | Non-deterministic, requires retry semantics |
| Activity | External service calls | Must be isolated for replay safety |

### Activity Design

Three activities were implemented, each representing a distinct side-effect boundary:

```typescript
parseTask(input)     // External parsing (could be LLM/NLP service)
fetchSourceA(spec)   // Network I/O to source A
fetchSourceB(spec)   // Network I/O to source B
```

The synthesis step is a pure function inside the workflow. Making it an activity would add latency without providing retry benefits.

**Why not child workflows?** Child workflows would be appropriate if sub-tasks needed independent retry budgets, were reusable across workflows, or if event history would exceed approximately 50K events. None of these conditions apply here.

### Retry Strategy

```typescript
// Network activities: aggressive retry with backoff
{ maximumAttempts: 5, initialInterval: '500ms', backoffCoefficient: 2 }

// Parse activity: fail fast on validation errors
{ maximumAttempts: 2, nonRetryableErrorTypes: ['ValidationError'] }
```

Network failures are often transient and benefit from retries. Parse errors indicate bad input and will not resolve with retries.

### Failure Handling

```typescript
const results = await Promise.allSettled([fetchSourceA(spec), fetchSourceB(spec)]);
```

`Promise.allSettled` enables graceful degradation. Partial results are returned when one source fails, with error information included for transparency. This trades simplicity for resilience, as partial results are often preferable to total failure.

---

## Technologies Used

| Technology | Purpose |
|------------|---------|
| Temporal (TypeScript SDK) | Workflow orchestration, activity execution, durability |
| Next.js 14 (App Router) | Frontend and API routes |
| TypeScript | Type safety across workflow, activity, and frontend boundaries |
| pnpm | Package management |

---

## Trade-offs

| Decision | Trade-off |
|----------|-----------|
| Polling over WebSocket | Simpler implementation at the cost of real-time responsiveness. Temporal queries are well-suited for this pattern. |
| Single workflow type | Sufficient for cohesive task scope. Child workflows would add complexity without proportional benefit. |
| Mock activity implementations | Demonstrates correct architectural boundaries without external service dependencies. |
| UUID workflow IDs | Simple collision avoidance. Deterministic IDs would enable idempotency but add complexity beyond scope. |
| `Promise.allSettled` | More resilient but requires frontend to handle incomplete data. |

---

## Assumptions

The following assumptions were made where requirements were ambiguous:

1. **Task type**: Implemented a "research agent" pattern that fetches from multiple sources. This demonstrates orchestration without requiring real LLM integration.

2. **Status mechanism**: Polling via Temporal queries was selected over WebSocket/SSE. While less responsive, this approach is simpler and leverages Temporal's built-in query capability.

3. **Error granularity**: Activities throw typed errors that the workflow catches and handles explicitly, rather than relying on default Temporal behavior.

4. **Scope boundary**: A single workflow with multiple activities is sufficient for this task's cohesion level. Child workflows were considered but deemed over-engineering.

---

## Production Considerations

| Current State | Production Change |
|---------------|-------------------|
| Polling for status | WebSocket/SSE for real-time updates |
| Mock activities | Real API integrations with authentication |
| Single worker | Horizontal scaling with multiple workers |
| No persistence | PostgreSQL for task history and audit logs |
| UUID workflow IDs | Deterministic IDs for idempotency guarantees |
| No observability | Prometheus metrics, structured logging, distributed tracing |

---

## Project Structure

```
temporal/
├── src/
│   ├── workflows/agentWorkflow.ts  # Orchestration logic
│   ├── activities/index.ts         # Side-effect implementations
│   ├── types.ts                    # Shared type definitions
│   ├── client.ts                   # Temporal client utilities
│   └── worker.ts                   # Worker configuration
frontend/
├── src/app/
│   ├── api/execute/route.ts        # Start workflow endpoint
│   ├── api/status/[id]/route.ts    # Query status endpoint
│   └── page.tsx                    # Task submission UI
```

---

## Closing Note

This submission addresses intentional ambiguity in the requirements by making explicit architectural choices and documenting the reasoning behind each decision. Where the specification was open-ended, I prioritized demonstrating correct Temporal usage patterns over feature scope.

The activity boundaries, retry policies, and failure handling strategies were designed to reflect production-grade thinking while remaining within the scope of a systems design exercise. Mock implementations are used where noted, but the architectural boundaries are production-appropriate and would require minimal refactoring for real service integration.
