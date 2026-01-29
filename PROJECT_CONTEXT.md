# Project Context (Working Memory)

> **Purpose**: Track implementation progress, decisions, and open items during development.
> This file is for development efficiency, not submission polish.

---

## Current Status

**Phase**: EXECUTION - Temporal Core Complete  
**Last Updated**: 2026-01-29

---

## Implemented

- [x] IMPLEMENTATION_PLAN.md created
- [x] README.md created
- [x] PROJECT_CONTEXT.md created
- [x] Initialize `temporal/` directory with TypeScript
- [x] Define types in `temporal/src/types.ts`
- [x] Implement `parseTask` activity
- [x] Implement `fetchSourceA` activity  
- [x] Implement `fetchSourceB` activity
- [x] Implement `agentWorkflow` with retry policies
- [x] Configure worker in `temporal/src/worker.ts`
- [x] Create client utilities in `temporal/src/client.ts`

---

## Pending

### Phase 2: Project Setup (Remaining)
- [ ] Install Temporal dependencies (`pnpm install`)
- [ ] Test worker startup

### Phase 3: Frontend
- [ ] Initialize `frontend/` with Next.js (App Router)
- [ ] Create `/api/execute` route (POST → start workflow)
- [ ] Create `/api/status/[workflowId]` route (GET → query status)
- [ ] Build `TaskExecutor` component (form + status display)
- [ ] Wire up polling for status updates

### Phase 4: Integration & Testing
- [ ] Test workflow execution end-to-end
- [ ] Test failure scenarios
- [ ] Verify retry behavior

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-29 | Use "research agent" as task type | Simple, demonstrates orchestration without real LLM |
| 2026-01-29 | Polling over WebSocket | Time-boxed scope, Temporal queries work well |
| 2026-01-29 | 3 activities (parse, fetchA, fetchB) | Meets minimum, easy to extend |
| 2026-01-29 | Parallel fetch with allSettled | Graceful partial failure handling |

---

## Open Questions

1. **Workflow ID strategy**: Using UUID. Should I use deterministic IDs for idempotency demo?
   - **Decision**: UUID is fine. Document idempotency as production consideration.

2. **How much UI polish?**: Assignment says UI is not the focus.
   - **Decision**: Minimal but functional. Form + status display + error handling.

3. **Should I add workflow queries for step-by-step status?**
   - **Decision**: Nice to have. Implement if time permits.

---

## Known Limitations

1. **Mock implementations**: Activities return fake data. Real integration out of scope.
2. **No persistence**: Task history not saved. Would use PostgreSQL in production.
3. **Single worker**: No horizontal scaling. Would run multiple workers in production.
4. **No auth**: Anyone can trigger workflows. Would add auth layer in production.

---

## Useful Commands

```bash
# Start Temporal dev server
temporal server start-dev

# Start worker (from temporal/ directory)
pnpm dev

# Start frontend (from frontend/ directory)
pnpm dev

# View Temporal Web UI
open http://localhost:8233
```

---

## Code Snippets for Reference

### Activity Proxy Setup
```typescript
const activities = proxyActivities<typeof activities>({
  startToCloseTimeout: '30s',
  retry: {
    maximumAttempts: 5,
    initialInterval: '500ms',
    backoffCoefficient: 2,
  },
});
```

### Starting Workflow from API
```typescript
const handle = await client.workflow.start(agentWorkflow, {
  taskQueue: 'agent-tasks',
  workflowId: `agent-${crypto.randomUUID()}`,
  args: [taskInput],
});
return { workflowId: handle.workflowId };
```

### Querying Workflow Status
```typescript
const handle = client.workflow.getHandle(workflowId);
const description = await handle.describe();
return {
  status: description.status.name,
  result: description.status.name === 'COMPLETED' ? await handle.result() : null,
};
```

---

## Files to Create

```
temporal-workflow-agent/
├── temporal/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── types.ts
│       ├── activities/index.ts
│       ├── workflows/agentWorkflow.ts
│       └── worker.ts
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/app/
│       ├── page.tsx
│       ├── api/execute/route.ts
│       └── api/status/[workflowId]/route.ts
├── README.md ✓
├── IMPLEMENTATION_PLAN.md ✓
└── PROJECT_CONTEXT.md ✓
```
