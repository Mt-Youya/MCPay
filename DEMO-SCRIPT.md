# MCPay — Hackathon Demo Script

## Opening

> Today, AI agents can think and use tools, but they still depend on humans to establish most commercial relationships for them.
>
> MCPay gives an agent a goal and a budget, then lets it discover, evaluate, purchase, and use services autonomously.

## Demo input

```text
Research the Monad ecosystem and identify five promising emerging projects.
```

Budget:

```text
$0.10
```

Click:

```text
Run Agent
```

## What the screen should show

### 1. Planning

```text
Planning...

Need:
✓ Web Search
✓ Market Data
✓ Social Data
```

### 2. Provider discovery

```text
Evaluating Web Search providers...

SearchCheap   $0.0005   82%
SearchPro     $0.0010   97%
SearchUltra   $0.0020   99%

✓ SearchPro selected
```

Say:

> The agent isn't just calling a fixed API. It is making an economic choice between competing providers.

### 3. Payment Required

```text
HTTP 402
Payment Required

0.001
Network: Monad
Recipient: 0x...
```

Say:

> The Provider doesn't require a subscription or API key. It tells the Agent what the service costs.

### 4. Autonomous payment

```text
Agent is paying...

✓ Confirmed on Monad
Tx: 0x...
```

Open the real explorer transaction if useful and reliable.

### 5. Paid execution

```text
✓ Payment verified
✓ Search completed
```

Continue through the remaining services without narrating every implementation detail.

### 6. Final screen

```text
Task Complete

Providers evaluated     5
Services purchased      3
Monad transactions      3
Spent                    $0.006
Human approvals         0
```

## Closing line

> **The agent didn't just use tools. It participated in an economy.**

---

# Judge Q&A

## Why blockchain?

> Agents need a neutral settlement layer when they buy from providers they have never interacted with before. Neither side needs a pre-existing billing account, subscription, or banking relationship.

## Why Monad?

> Agent commerce can be high-frequency and very low-value. Agents may make hundreds of $0.001 transactions rather than one $1,000 transaction, so low-cost, fast settlement matters.

## Why not Stripe?

> Stripe is great for established human-to-business payment relationships. MCPay explores autonomous machine-to-machine commerce with dynamically discovered providers.

## Why not API keys?

> API keys assume the provider is selected before the agent runs. MCPay lets the agent select providers while it runs.

## Isn't this just x402?

> x402 answers “how do I pay?” MCPay answers “what should I buy, who should I buy it from, and should I spend this money?”

## MCP, x402, Monad, MCPay?

```text
MCP      → capability
x402     → payment handshake
Monad    → settlement
MCPay    → commerce orchestration
```

## What prevents overspending?

> The user authorizes a task budget. The MVP enforces that budget in orchestration; the production path is smart-account-level spending policy.

## What if the Provider gets paid but does not respond?

> The prototype demonstrates payment and service execution. Escrow, signed outcomes, reputation, and disputes are a production extension and deliberately outside today's scope.

## Is the Agent really autonomous?

> After receiving only the goal and budget, it decides what capability it needs, which provider to buy from, whether the price is acceptable, pays, executes the service, and continues without per-purchase human approval.

## What did you actually build?

> We built an AI agent that receives a goal and a budget, discovers paid tools, compares providers, receives HTTP 402 payment requests, autonomously pays providers on Monad, executes those tools, and returns the final result without human approval.
