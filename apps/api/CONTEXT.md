# API Context

API owns one Task's orchestration from validated browser input to a final result.

## Responsibilities

- Enforce task request rate limits and, in deployed mode, verify Turnstile.
- Validate a non-empty goal and a positive `budgetMon`.
- Ask the planner for a supported Service, obtain Offers, and use shared deterministic ranking.
- Request a Provider's 402 terms, compare them against the selected Offer, then check affordability before settlement.
- Send the Monad transaction through the Agent Wallet and require a successful receipt.
- Retry the Provider with Payment Proof and pass its streamed research result through to the browser.

## Invariants

- A live Task supports only `web-research`.
- Payment Request terms must match the selected Offer exactly.
- A Budget failure sends no Monad transaction and creates no Execution.
- The API does not itself consume Payment Proof; that is Provider-owned durable state.

## Modes

`demo` uses deterministic Offers and no external network calls. `live` requires the LLM, Monad RPC, Agent private key and remote Provider configuration listed in `.env.example`.
