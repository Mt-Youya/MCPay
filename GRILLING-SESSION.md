# MCPay — Grilling Session Record

Date: 2026-08-15  
Context: Monad Hackathon  
Primary goal: **Win the hackathon**  
Available build time at decision freeze: **7 hours**

This file consolidates the decisions made across the grilling session.

## 2026-08-15 实现状态说明

本文件是“决策冻结时”的历史记录，不应作为当前功能清单。后续实现已经完成了 Cloudflare Worker monorepo、NDJSON 流式任务事件、Monad Testnet 支付验证、D1 防重放，以及 Tavily + DeepSeek 的证据化研究 Provider。

制作 PPT 或判断当前范围时，请优先使用：

- [`docs/PROJECT-OVERVIEW.md`](docs/PROJECT-OVERVIEW.md)
- [`docs/SYSTEM-ARCHITECTURE.md`](docs/SYSTEM-ARCHITECTURE.md)
- [`MVP-SCOPE.md`](MVP-SCOPE.md)

---

## Round 1 — Root constraints

### Q1 — Primary objective

**Decision: A — Win.**

Optimize for judge comprehension, Monad relevance, a visible wow moment, and a reliable live demo.

### Q2 — Idea

**Decision: MCPay.**

MCPay is the chosen idea.

### Q3 — Team

**Decision: C — 3–4 people.**

The team includes backend and AI Agent development capability, allowing frontend, backend/payment, agent orchestration, and Web3 work to proceed in parallel.

### Q4 — Current progress

**Decision: A — No implementation started.**

The project begins from zero.

### Q5 — Remaining time

**Decision: 7 hours.**

Scope must be treated as a one-session prototype.

### Q6 — Solidity tolerance

**Decision: B — A small contract is acceptable.**

Smart contracts support the product; they are not the main source of complexity.

### Q7 — Core story

**Decision: C.**

> AI Agents can complete commercial transactions without human participation.

---

## Round 2 — Product identity

### Q8 — Real users

**Decision: D — Three-sided marketplace, with the demo from the User perspective.**

Actors:

```text
User
 ↓
Agent
 ↓
MCPay Marketplace
 ↓
Provider
```

### Q9 — Problem MCPay solves

**Decision: E — The complete commerce chain.**

```text
discover
 ↓
evaluate
 ↓
purchase
 ↓
execute
 ↓
verify
```

Canonical positioning:

> We built the commerce layer for AI agents.

### Q10 — Demo task

**Decision: C — Generate a Monad ecosystem research result.**

Example:

> Research the Monad ecosystem and identify five promising emerging projects.

### Q11 — Real vs mock Providers

**Decision: C — Real core tools with a mock/fallback tool allowed.**

Preferred:

- Web Search — real
- Crypto Data — real
- Social Sentiment — mock/fallback allowed

### Q12 — Whose money the Agent spends

**Decision: C — User pre-funds an Agent balance / budget.**

The demo should make the Agent economically legible as an independent actor while avoiding complicated account-abstraction work.

### Q13 — Provider selection

**Decision: C — Evaluate price, reputation, latency, and quality.**

The Agent should make an economic choice rather than merely invoke a predetermined tool.

### Q14 — Contract role

**Decision: D — Minimal Registry + Payment, with aggressive fallback.**

Do not build complex reputation or escrow contracts.

---

## Round 3 — Domain model

### Q15 — Agent identity

**Decision: C — Each User conceptually owns an Agent Wallet.**

### Q16 — Budget enforcement

**Decision: B — Enforce Task Budget in backend/orchestration for the MVP.**

Future smart-account enforcement is explicitly out of scope.

### Q17 — Provider source of truth

**Decision: C — Hybrid model.**

Minimal economic/ownership state may be on-chain; mutable descriptive metadata remains off-chain.

### Q18 — Tool discovery

**Decision: C — Marketplace list + LLM capability selection.**

The LLM decides which supported capabilities are needed from the goal. The implementation exposes a bounded service set.

### Q19 — Purchase approval

**Decision: C — No per-purchase approval.**

The Budget is the User's authorization boundary.

### Q20 — Payment timing

**Decision: D — 402 → payment → retry.**

### Q21 — Business model

**Decision: B — 1% protocol fee as the target model.**

This is a P2 feature for the hackathon and may be omitted if it threatens the golden path.

### Q22 — Reputation

**Decision: C — Derived from execution success data.**

For the prototype, reputation may be seeded/simplified and is a selection signal, not a security guarantee.

---

## Canonical domain relationships

```text
User
 │
 └── Agent
      │
      ├── Agent Wallet
      │
      └── Task
           │
           ├── Budget
           │
           └── Executions
                 │
                 ├── Offer
                 │     │
                 │     └── Provider
                 │
                 └── Payment
```

Critical distinction:

> **Service ≠ Provider**

A Service is a capability. Multiple Providers may publish competing Offers for the same Service.

Example:

```text
Service: Web Search

SearchCheap  → $0.0005 → 82 reputation
SearchPro    → $0.0010 → 97 reputation
SearchUltra  → $0.0020 → 99 reputation
```

---

## Round 4 — Demo design

### Q23 — Homepage

**Decision: C — Goal input is the hero.**

The first screen should let a judge immediately run the product.

### Q24 — Wallet requirement

**Decision: B — Pre-funded demo Agent.**

Do not put wallet connection, network switching, approvals, and deposits in the critical demo path.

### Q25 — Main visualization

**Decision: C — Agent Execution Graph.**

Core states:

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

### Q26 — Show HTTP 402

**Decision: C — Make it a visible product event.**

The judge should see:

1. Service request
2. `402 Payment Required`
3. Agent decision
4. Monad payment
5. Retry with payment proof
6. `200 OK`

### Q27 — Number of services

**Decision: C — Show three; require only one or two to be production-reliable.**

### Q28 — Multiple Providers

**Decision: C — Show provider competition for Web Search only.**

### Q29 — Selection algorithm

**Decision: C — Deterministic score + LLM explanation.**

Suggested shape:

```text
score =
  reputation * 0.50 +
  quality * 0.30 +
  priceScore * 0.15 +
  latencyScore * 0.05
```

The algorithm chooses; the LLM explains the choice.

### Q30 — Final result emphasis

**Decision: D + B — Execution history plus economics.**

The generated research content only needs to be credible. The hero metrics are the autonomous transactions.

Recommended final screen:

```text
Task Complete

Providers evaluated    5
Services purchased     3
Monad transactions     3
Spent                   $0.006
Human approvals        0
```

### Q31 — Marketplace page

**Decision: C — Minimal proof-of-concept page only.**

### Q32 — Provider registration UI

**Decision: C — Contract/API capability may exist; UI is omitted.**

### Q33 — Agent funding page

**Decision: C — Show balance only; omit funding UX from the demo.**

---

## Round 5 — Seven-hour build contract

### Q34 — Definition of success

**Decision: D — One real end-to-end blockchain commerce loop.**

```text
User Goal
 ↓
Agent Planning
 ↓
Discover Provider
 ↓
Choose Provider
 ↓
HTTP 402
 ↓
Monad Payment
 ↓
Provider verifies payment
 ↓
Tool Result
 ↓
Final Answer
```

### Q35 — What must be real

Must be real:

- LLM Agent invocation
- At least one real Tool execution
- Real Monad transaction
- Real transaction hash
- Provider selection from Provider data
- Real `402 → pay → retry` flow

May be mocked/seeded:

- reputation
- marketplace execution counts
- social sentiment provider
- some latency/price history
- dashboard historical data

Must not be faked:

- Monad transaction
- payment action
- the core paid-tool execution loop

### Q36 — Contract complexity

**Decision: C, with fallback to A.**

Target:

- minimal Registry
- Payment
- optional protocol fee

Fallback:

- payment-only contract / direct payment if integration speed demands it

### Q37 — x402 implementation

**Decision: A, fallback B.**

Use the official/compatible approach if it integrates quickly. Otherwise preserve the essential semantics with a minimal 402-compatible flow.

### Q38 — Team split

If four people:

```text
Frontend
→ Run Agent UI
→ Execution Graph
→ Provider comparison
→ payment state
→ final result

Backend
→ Provider server
→ HTTP 402
→ payment verification
→ tool proxy

Agent
→ planner
→ capability selection
→ provider scoring/orchestration
→ synthesis

Web3 / flex
→ contract
→ Monad deployment
→ wallet
→ transaction integration
```

If three people:

```text
Frontend
→ UI

Backend
→ 402 + contract/payment

Agent
→ planner + tools + orchestration
```

### Q39 — Frontend/backend contract

**Decision: SSE AgentEvent stream.**

Suggested events:

```ts
type AgentEvent =
  | { type: "planning"; message: string }
  | { type: "providers_found"; service: string; providers: Provider[] }
  | { type: "provider_selected"; provider: Provider; reason: string }
  | { type: "payment_required"; amount: string; recipient: string }
  | { type: "payment_pending"; txHash: string }
  | { type: "payment_confirmed"; txHash: string }
  | { type: "tool_completed"; tool: string; latency: number }
  | { type: "completed"; result: string; spent: string }
```

Suggested entrypoint:

```text
POST /api/tasks
→ SSE stream
```

### Q40 — Planner freedom

**Decision: C — LLM plans over a controlled capability set.**

The product looks open-ended to the User while the prototype remains reliable.

### Q41 — Provider decision

**Decision: deterministic score + LLM explanation.**

Semantic decisions belong to the LLM; financial/provider ranking should remain deterministic.

### Q42 — Research quality

**Decision: C — Credible is enough.**

Do not spend the hackathon optimizing the research Agent rather than the commerce protocol.

### Q43 — Marketplace timing

**Decision: Only after the golden path works.**

### Q44 — Animation scope

**Decision: Core state animation only.**

Do not build Three.js/WebGL/complex decorative systems during the seven-hour prototype.

---

## Build checkpoints

### Hour 0–1

Freeze schemas:

- Provider
- AgentEvent
- Task API
- 402 payload
- contract interface

Parallel implementation begins.

### Hour 1–2

Real Monad payment must work and be explorer-verifiable.

Frontend may use fake events while the backend catches up.

### Hour 2–3

Complete the paid request loop:

```text
GET Tool
 ↓
402
 ↓
Pay
 ↓
txHash
 ↓
Retry
 ↓
200
```

### Hour 3 checkpoint

The full loop should work from a terminal.

If not, cut features immediately.

### Hour 3–4

Connect the LLM planner and provider selection to one real Service.

### Hour 4–5

Integrate frontend through SSE.

### Hour 5 checkpoint

Browser action must trigger:

- Agent run
- real Monad payment
- real paid tool result

If not, enter survival mode.

Cut in this order:

1. Social Tool
2. Crypto Tool
3. Marketplace page
4. 1% fee
5. Registry
6. reputation logic

Keep:

- Agent
- one Tool
- 402
- real Monad payment
- result

### Hour 5–6

Only after the golden path works:

- provider comparison
- second Tool
- third Tool
- transaction list
- minimal Marketplace

### Hour 6–7

No new features.

Only:

- bug fixes
- seeded demo data
- fallback API/model
- wallet/RPC testing
- README
- demo script
- fallback demo recording

---

## Priority stack

### P0

- Real Monad Payment
- HTTP 402
- One real Tool
- Agent selection
- End-to-end demo

### P1

- Multiple Providers
- Provider scoring
- SSE UI
- transaction explorer link
- second Tool

### P2

- third Tool
- Marketplace page
- protocol fee
- polish animations

### P3 — Explicitly out of scope today

- Provider registration UX
- user wallet funding UX
- complex reputation
- smart accounts
- ERC-8004 integration
- escrow
- login/signup
- DAO/token/NFT
- multi-agent framework

---

## Round 6 — Judge attack surface

### Q45 — Why blockchain?

Because autonomous Agents need a neutral settlement layer for purchasing services from Providers with whom neither the Agent nor User has a pre-existing billing relationship.

Key line:

> Machines can establish an economic relationship with previously unknown machines.

### Q46 — Why Monad?

MCPay targets high-frequency, low-value machine-to-machine transactions. An Agent may buy many tiny services per Task, so low-cost, fast, high-throughput settlement matters.

Key line:

> AI agents may make hundreds of $0.001 transactions rather than one $1,000 transaction.

### Q47 — Why not Stripe?

Stripe is optimized for established human/business payment relationships. MCPay explores autonomous machine-to-machine purchases from dynamically discovered Providers.

### Q48 — Why not API keys?

API keys assume the Provider is selected before the Agent runs.

Key line:

> API keys assume the provider is chosen before the agent runs. MCPay allows the agent to choose providers while it runs.

### Q49 — Is this just an x402 wrapper?

No. x402 is a payment primitive/handshake; MCPay owns the commerce decisions above it.

Key line:

> x402 answers “how do I pay?” MCPay answers “what should I buy, who should I buy it from, and should I spend this money?”

### Q50 — MCP vs x402 vs Monad vs MCPay

```text
MCP      = capability layer
x402     = payment handshake
Monad    = settlement layer
MCPay    = commerce orchestration layer
```

### Q51 — Why does the Marketplace need blockchain?

It does not need all metadata on-chain. The economic state that benefits from independent verification is ownership/payment/execution history; descriptive metadata remains off-chain.

### Q52 — What if the Agent overspends?

Every Task has a User-defined Budget. The MVP enforces it in orchestration. A future version may enforce the same policy at smart-account level.

### Q53 — Provider takes money but does not respond?

Escrow, signed responses, and dispute mechanisms are a production extension. They are deliberately outside the MVP.

### Q54 — Can Reputation be gamed?

Prototype Reputation is simplified. A production system can derive stronger reputation from paid executions, unique identities, and verified outcomes.

### Q55 — Why does AI choose Providers instead of normal code?

AI understands semantic intent and required capabilities. Deterministic code handles the economic ranking.

```text
LLM
→ semantic decision

Algorithm
→ economic decision
```

### Q56 — Is the Agent truly autonomous?

After the User supplies a Goal and Budget, the Agent independently determines:

- which capabilities are needed
- which Provider to use
- whether the price is acceptable
- whether to pay
- whether to continue

Target final metric:

> 3 services purchased. 3 payments settled. 0 human approvals.

### Q57 — Who is the customer?

Initial demand side:

- Agent developers

Supply side:

- MCP/API Providers

### Q58 — Why would Providers join?

MCPay lets a Provider expose a capability, set a price, and receive machine payments without requiring every Agent to establish a subscription/account/API-key relationship first.

### Q59 — Moat

Long-term network value may compound through:

- Provider graph
- Agent graph
- pricing history
- execution/reputation history

Do not overstate this at hackathon stage.

### Q60 — What did we build?

> We built an AI agent that receives a goal and a budget, discovers paid tools, compares providers, receives HTTP 402 payment requests, autonomously pays providers on Monad, executes those tools, and returns the final result without human approval.

---

## Frozen product definition

> **MCPay is a commerce layer for autonomous AI agents, allowing agents to discover, evaluate, purchase and use digital services without human checkout.**

Final conceptual model:

```text
MCP
→ Capability

MCPay
→ Commerce

x402
→ Payment handshake

Monad
→ Settlement
```

Final golden path:

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

---

## Scope freeze

Do not add today:

- Login
- Signup
- Full wallet UX
- User profile
- complex Marketplace
- Provider Dashboard
- escrow
- DAO
- token
- NFT
- complex reputation
- ERC-8004 integration
- Smart Account
- full MCP ecosystem
- five Agents
- multi-agent framework
