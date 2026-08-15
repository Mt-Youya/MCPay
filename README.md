# MCPay — Agent Commerce on Monad

This monorepo implements the MCPay agent-commerce golden path. A User gives an Agent a MON Budget; the Agent discovers a Provider, receives a `402` Payment Request, settles on Monad Testnet, then retries the Provider with the transaction hash.

The structure follows the intent of Matt Pocock's `grill-with-docs` + `domain-modeling` workflow:

- `CONTEXT.md` — canonical domain language / glossary only
- `docs/adr/` — architectural decision records for decisions that are costly or confusing to reverse
- `GRILLING-SESSION.md` — consolidated record of the 60 grilling questions and locked decisions
- `MVP-SCOPE.md` — implementation handoff for the 7-hour hackathon build
- `DEMO-SCRIPT.md` — judge-facing demo and Q&A script

## Run the local demo

```bash
fnm exec --using=24 -- pnpm install
fnm exec --using=24 -- pnpm dev
```

The demo API and web app are available at `http://127.0.0.1:5173`. It uses deterministic Offers and never touches a wallet or external API.

## Run the real research Provider

The Provider is a Cloudflare Worker. It searches with Tavily, asks DeepSeek to synthesize only the retrieved evidence, returns its title/URL citations, and records every verified Monad transaction hash in D1 before allowing one Execution.

1. Sign in to Cloudflare: `fnm exec --using=24 -- pnpm --filter @mcpay/provider cf:login`.
2. Create the D1 database: `fnm exec --using=24 -- pnpm --filter @mcpay/provider cf:d1:create`. Copy the returned ID into `database_id` in [apps/provider/wrangler.jsonc](apps/provider/wrangler.jsonc), replacing the all-zero placeholder.
3. Copy [apps/provider/.dev.vars.example](apps/provider/.dev.vars.example) to `apps/provider/.dev.vars`, then fill in a Provider receiving address, Tavily key, and a **separate** DeepSeek key.
4. Create the local schema and test locally with `fnm exec --using=24 -- pnpm dev:provider`.
5. Apply the same schema to Cloudflare: `fnm exec --using=24 -- pnpm --filter @mcpay/provider cf:migrate`.
6. Add those same values to the deployed Worker. Each command opens a secure input prompt; do not put the value on the command line.

   ```bash
   fnm exec --using=24 -- pnpm --filter @mcpay/provider exec wrangler secret put MCPAY_PROVIDER_RECEIVING_ADDRESS
   fnm exec --using=24 -- pnpm --filter @mcpay/provider exec wrangler secret put MCPAY_PROVIDER_DEEPSEEK_API_KEY
   fnm exec --using=24 -- pnpm --filter @mcpay/provider exec wrangler secret put MCPAY_PROVIDER_TAVILY_API_KEY
   ```

7. Deploy with `fnm exec --using=24 -- pnpm --filter @mcpay/provider cf:deploy`.
8. Copy [apps/api/.env.example](apps/api/.env.example) to `apps/api/.env`, set `MCPAY_RUNTIME_MODE=live`, and replace `<your-subdomain>` in both Provider URLs with the Workers URL that deployment reports. Add the Agent Wallet private key and its own DeepSeek settings.
9. Fund the Agent Wallet with Monad Testnet MON, then run `fnm exec --using=24 -- pnpm dev`.

The local D1 state, `.dev.vars`, and `.env` files are ignored by Git. Do not paste a private key or an API key into source code or GitHub.

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
