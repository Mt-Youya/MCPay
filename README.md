# MCPay — Grill With Docs Output

This package captures the decisions from the Monad Hackathon grilling session.

The structure follows the intent of Matt Pocock's `grill-with-docs` + `domain-modeling` workflow:

- `CONTEXT.md` — canonical domain language / glossary only
- `docs/adr/` — architectural decision records for decisions that are costly or confusing to reverse
- `GRILLING-SESSION.md` — consolidated record of the 60 grilling questions and locked decisions
- `MVP-SCOPE.md` — implementation handoff for the 7-hour hackathon build
- `DEMO-SCRIPT.md` — judge-facing demo and Q&A script

## Product in one sentence

**MCPay is a commerce layer for autonomous AI agents, allowing agents to discover, evaluate, purchase, and use digital services without human checkout.**

## Core stack model

```text
MCP      → Capability
MCPay    → Commerce orchestration
x402     → Payment handshake
Monad    → Settlement
```

## Golden path

```text
Goal + Budget
    ↓
AI Agent
    ↓
Plan
    ↓
Discover Services
    ↓
Compare Providers
    ↓
HTTP 402
    ↓
Autonomous Payment
    ↓
Monad
    ↓
Tool Execution
    ↓
Final Result
```
