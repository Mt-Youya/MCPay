# Domain docs

## Before exploring

- Read `CONTEXT-MAP.md` to select the relevant workspace context.
- Read the root `CONTEXT.md` for system-level MCPay vocabulary.
- Read relevant system ADRs in `docs/adr/` and context-specific ADRs in the selected workspace.

If a workspace context does not exist yet, use the root context and relevant system ADRs; create its context only when its language or decisions are resolved.

## Layout

MCPay uses a multi-context monorepo layout:

```text
/
├── CONTEXT-MAP.md
├── CONTEXT.md
├── docs/adr/                    # system-wide decisions
├── apps/
│   ├── web/                     # User-facing Task experience
│   └── api/                     # Task orchestration and integrations
└── packages/
    └── commerce/                # shared commerce contracts and rules
```

Each workspace may own a `CONTEXT.md` and `docs/adr/` for workspace-specific language and decisions. Root ADRs govern the complete MCPay system.

## Vocabulary and ADRs

Use the root glossary for User, Agent, Agent Wallet, Task, Budget, Service, Provider, Offer, Execution, Payment Request, Payment, Settlement, and Human Approval. Do not replace those terms with glossary synonyms marked as avoided.

If a proposed change contradicts an ADR, name the conflict explicitly instead of silently changing the decision.
