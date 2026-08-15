# MCPay — 7-Hour MVP Scope

## Success condition

The build is successful if a judge can trigger one complete, real commerce loop from the browser:

```text
Goal + Budget
 ↓
Agent understands required capability
 ↓
Providers discovered
 ↓
Provider selected
 ↓
402 Payment Required
 ↓
Real Monad payment
 ↓
Provider verifies payment
 ↓
Real Tool executes
 ↓
Result returns
```

## P0 — Must ship

1. One real LLM planning step.
2. One real paid Service.
3. At least two competing Offers for the showcased Service.
4. Deterministic provider ranking.
5. Real 402-style Payment Request.
6. Real Monad transaction with a real tx hash.
7. Payment verification before Service execution.
8. Browser-visible execution state.
9. Final economics summary.

## P1 — Ship only after P0 works

- Second real Service
- Third fallback/mock Service
- SSE event stream
- Explorer links
- richer Provider comparison
- minimal Marketplace page

## P2

- protocol fee
- third real Service
- extra animation polish

## Explicit non-goals

- authentication
- complete wallet onboarding
- production custody model
- on-chain reputation
- escrow/disputes
- smart-account delegation
- ERC-8004 integration
- provider administration UI
- DAO/token/NFT
- unrestricted agent tool execution
- multi-agent orchestration

## Suggested API

### Create task

```http
POST /api/tasks
Content-Type: application/json
```

```json
{
  "goal": "Research the Monad ecosystem and identify five promising projects.",
  "budget": "0.10"
}
```

### Agent events

```ts
type AgentEvent =
  | {
      type: "planning"
      message: string
    }
  | {
      type: "providers_found"
      service: string
      providers: Provider[]
    }
  | {
      type: "provider_selected"
      provider: Provider
      reason: string
    }
  | {
      type: "payment_required"
      amount: string
      recipient: string
    }
  | {
      type: "payment_pending"
      txHash: string
    }
  | {
      type: "payment_confirmed"
      txHash: string
    }
  | {
      type: "tool_completed"
      tool: string
      latency: number
    }
  | {
      type: "completed"
      result: string
      spent: string
    }
```

## Suggested Provider shape

```ts
type Provider = {
  id: string
  name: string
  service: string
  endpoint: string
  recipient: `0x${string}`
  price: string
  reputation: number
  quality: number
  latencyMs: number
}
```

## Provider ranking

Keep the economic decision deterministic:

```ts
score = reputation * 0.5 + quality * 0.3 + priceScore * 0.15 + latencyScore * 0.05
```

Use the LLM to explain the selected Provider, not to make an unpredictable financial ranking.

## 402-compatible fallback protocol

First request:

```http
GET /api/providers/search?q=Monad
```

Response:

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
```

```json
{
  "service": "web_search",
  "price": "0.001",
  "network": "monad",
  "recipient": "0x..."
}
```

After payment:

```http
GET /api/providers/search?q=Monad
X-Payment-Tx: 0x...
```

Provider validates:

- transaction exists
- recipient matches
- amount is sufficient
- payment has not already been consumed, if replay protection is implemented

Then:

```http
HTTP/1.1 200 OK
```

## Frontend states

Do not overbuild.

```text
Idle
Running
Success
Error
```

Execution graph:

```text
Planner
 ↓
Discover
 ↓
Select
 ↓
Pay
 ↓
Execute
```

## Survival-mode cut list

If the golden path is not browser-complete by hour five, remove in order:

1. Social service
2. Crypto service
3. Marketplace page
4. Protocol fee
5. Registry contract
6. Reputation history logic

Never remove:

- Agent intent step
- one real Service
- 402
- real Monad payment
- result
