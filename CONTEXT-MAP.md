# MCPay Context Map

MCPay is organized as a monorepo. This map directs agents to the context that owns the decision they are about to make.

## System context

- The system-wide MCPay glossary remains in `CONTEXT.md` until a workspace introduces context-specific language.
- System-wide, costly-to-reverse decisions remain in `docs/adr/`.

## Workspace contexts

- `apps/web/CONTEXT.md` owns the browser experience for Users who create and observe Tasks.
- `apps/api/CONTEXT.md` owns Task orchestration, Provider communication, Payment Requests, Payments, and Executions.
- `apps/provider/CONTEXT.md` owns paid research execution, Payment Proof verification, and Payment Consumption.
- `packages/commerce/CONTEXT.md` owns shared Budget, Offer-selection, and protocol contracts used by both applications.

If a workspace context has not been created yet, consult the system context and relevant system ADRs before adding it.
