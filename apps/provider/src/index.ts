import { Hono } from "hono"
import { createPublicClient, defineChain, http } from "viem"

import type { Offer } from "@mcpay/commerce"

export type PaymentProof = {
  transactionId: `0x${string}`
  recipient: `0x${string}`
  paymentAmountNative: string
}

export type ResearchResult = {
  result: string
  citations: Array<{ title: string; url: string }>
}

export type ProviderRuntime = {
  offer: Offer
  verifyPayment: (proof: PaymentProof) => Promise<void>
  consumePayment: (proof: PaymentProof) => Promise<boolean>
  research: (goal: string) => Promise<ResearchResult>
}

export type ExecutionRateLimiter = {
  limit: (options: { key: string }) => Promise<{ success: boolean }>
}

type PaymentConsumptionDatabase = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      run: () => Promise<{ meta: { changes: number } }>
    }
  }
}

export const createD1PaymentStore = (database: PaymentConsumptionDatabase) => {
  return {
    async consume(proof: PaymentProof) {
      const result = await database
        .prepare("INSERT OR IGNORE INTO payment_consumptions (transaction_id, consumed_at) VALUES (?, ?)")
        .bind(proof.transactionId, new Date().toISOString())
        .run()
      return result.meta.changes === 1
    },
  }
}

const paymentRequest = (offer: Offer) => ({
  protocolStatus: 402 as const,
  amountMon: offer.priceMon,
  recipient: offer.recipient,
  network: "monad" as const,
  paymentAmountNative: offer.paymentAmountNative,
})

const paymentProof = (request: Request): PaymentProof | null => {
  const transactionId = request.headers.get("x-payment-tx")
  const recipient = request.headers.get("x-payment-recipient")
  const paymentAmountNative = request.headers.get("x-payment-amount")
  if (!transactionId && !recipient && !paymentAmountNative) return null
  if (
    !transactionId ||
    !recipient ||
    !paymentAmountNative ||
    !/^0x[\da-fA-F]{64}$/.test(transactionId) ||
    !/^0x[\da-fA-F]{40}$/.test(recipient) ||
    !/^\d+$/.test(paymentAmountNative)
  ) {
    throw new Error("Payment Proof is invalid")
  }
  return { transactionId: transactionId as `0x${string}`, recipient: recipient as `0x${string}`, paymentAmountNative }
}

const hasExpectedTerms = (proof: PaymentProof, offer: Offer) =>
  proof.recipient.toLowerCase() === offer.recipient.toLowerCase() &&
  proof.paymentAmountNative === offer.paymentAmountNative

const requestClientIp = (request: Request) => request.headers.get("cf-connecting-ip") ?? "unknown"

export const createProviderApp = (runtime: ProviderRuntime, executeRateLimiter?: ExecutionRateLimiter) => {
  const app = new Hono()

  app.get("/health", (context) => context.json({ status: "ok" }))
  app.get("/offers", (context) => context.json({ offers: [runtime.offer] }))

  app.post("/execute", async (context) => {
    if (executeRateLimiter) {
      const { success } = await executeRateLimiter.limit({ key: requestClientIp(context.req.raw) })
      if (!success) {
        context.header("Retry-After", "60")
        return context.json({ message: "Too many Execution requests. Try again later." }, 429)
      }
    }

    const body = (await context.req.json()) as { goal?: unknown; service?: unknown }
    if (typeof body.goal !== "string" || body.goal.trim().length === 0 || body.service !== runtime.offer.service) {
      return context.json({ message: "A supported Service and Task goal are required." }, 400)
    }

    let proof: PaymentProof | null
    try {
      proof = paymentProof(context.req.raw)
    } catch (error) {
      return context.json({ message: error instanceof Error ? error.message : "Payment Proof is invalid" }, 400)
    }
    if (!proof) return context.json(paymentRequest(runtime.offer), 402)
    if (!hasExpectedTerms(proof, runtime.offer))
      return context.json({ message: "Payment Proof terms do not match Offer." }, 400)

    try {
      await runtime.verifyPayment(proof)
    } catch (error) {
      return context.json({ message: error instanceof Error ? error.message : "Payment Proof was not verified." }, 402)
    }
    if (!(await runtime.consumePayment(proof)))
      return context.json({ message: "Payment Proof was already consumed." }, 409)

    try {
      const research = await runtime.research(body.goal.trim())
      return context.json({ paymentVerified: true, ...research })
    } catch (error) {
      return context.json({ message: error instanceof Error ? error.message : "Research Execution failed." }, 502)
    }
  })

  return app
}

type ProviderConfig = {
  receivingAddress: `0x${string}`
  monadRpcUrl: string
  monadChainId: number
  deepseekApiKey: string
  deepseekBaseUrl: string
  deepseekModel: string
  tavilyApiKey: string
}

type ProviderEnvironment = {
  DB: PaymentConsumptionDatabase
  MCPAY_EXECUTE_RATE_LIMITER: ExecutionRateLimiter
  MCPAY_PROVIDER_RECEIVING_ADDRESS: string
  MCPAY_PROVIDER_MONAD_RPC_URL: string
  MCPAY_PROVIDER_MONAD_CHAIN_ID: string
  MCPAY_PROVIDER_DEEPSEEK_API_KEY: string
  MCPAY_PROVIDER_DEEPSEEK_BASE_URL: string
  MCPAY_PROVIDER_DEEPSEEK_MODEL: string
  MCPAY_PROVIDER_TAVILY_API_KEY: string
}

type TavilyResponse = { results?: Array<{ title?: unknown; url?: unknown; content?: unknown }> }
type DeepSeekResponse = { choices?: Array<{ message?: { content?: string } }> }

const required = (
  environment: ProviderEnvironment,
  environmentName: Exclude<keyof ProviderEnvironment, "DB" | "MCPAY_EXECUTE_RATE_LIMITER">
) => {
  const value = environment[environmentName]
  if (!value) throw new Error(`${environmentName} is required`)
  return value
}

const providerConfig = (environment: ProviderEnvironment): ProviderConfig => ({
  receivingAddress: required(environment, "MCPAY_PROVIDER_RECEIVING_ADDRESS") as `0x${string}`,
  monadRpcUrl: required(environment, "MCPAY_PROVIDER_MONAD_RPC_URL"),
  monadChainId: Number(required(environment, "MCPAY_PROVIDER_MONAD_CHAIN_ID")),
  deepseekApiKey: required(environment, "MCPAY_PROVIDER_DEEPSEEK_API_KEY"),
  deepseekBaseUrl: required(environment, "MCPAY_PROVIDER_DEEPSEEK_BASE_URL").replace(/\/$/, ""),
  deepseekModel: required(environment, "MCPAY_PROVIDER_DEEPSEEK_MODEL"),
  tavilyApiKey: required(environment, "MCPAY_PROVIDER_TAVILY_API_KEY"),
})

const verifyMonadPayment = (config: ProviderConfig, offer: Offer) => async (proof: PaymentProof) => {
  const chain = defineChain({
    id: config.monadChainId,
    name: "Monad",
    nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: [config.monadRpcUrl] } },
  })
  const client = createPublicClient({ chain, transport: http(config.monadRpcUrl) })
  const [receipt, transaction] = await Promise.all([
    client.getTransactionReceipt({ hash: proof.transactionId }),
    client.getTransaction({ hash: proof.transactionId }),
  ])
  if (
    receipt.status !== "success" ||
    transaction.to?.toLowerCase() !== offer.recipient.toLowerCase() ||
    transaction.value !== BigInt(offer.paymentAmountNative)
  ) {
    throw new Error("Monad Payment does not match the requested recipient and amount")
  }
}

const researchWithEvidence =
  (config: ProviderConfig) =>
  async (goal: string): Promise<ResearchResult> => {
    const tavilyResponse = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { authorization: `Bearer ${config.tavilyApiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ query: goal, search_depth: "basic", max_results: 5 }),
    })
    if (!tavilyResponse.ok) throw new Error(`Tavily search failed with ${tavilyResponse.status}`)
    const tavily = (await tavilyResponse.json()) as TavilyResponse
    const evidence = (tavily.results ?? [])
      .filter(
        (item): item is { title: string; url: string; content: string } =>
          typeof item.title === "string" && typeof item.url === "string" && typeof item.content === "string"
      )
      .slice(0, 5)
    if (evidence.length === 0) throw new Error("Tavily search returned no usable Research Evidence")

    const completionResponse = await fetch(`${config.deepseekBaseUrl}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${config.deepseekApiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: config.deepseekModel,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Return JSON with a concise result string. Answer only from the supplied evidence and do not invent sources.",
          },
          { role: "user", content: JSON.stringify({ goal, evidence }) },
        ],
      }),
    })
    if (!completionResponse.ok) throw new Error(`DeepSeek synthesis failed with ${completionResponse.status}`)
    const completion = (await completionResponse.json()) as DeepSeekResponse
    const content = completion.choices?.[0]?.message?.content
    if (!content) throw new Error("DeepSeek synthesis returned no content")
    const synthesis = JSON.parse(content) as { result?: unknown }
    if (typeof synthesis.result !== "string" || synthesis.result.trim().length === 0) {
      throw new Error("DeepSeek synthesis returned invalid JSON")
    }
    return { result: synthesis.result, citations: evidence.map(({ title, url }) => ({ title, url })) }
  }

export const createConfiguredProviderApp = (environment: ProviderEnvironment) => {
  const config = providerConfig(environment)
  const offer: Offer = {
    id: "mcpay-web-research-v1",
    providerName: "MCPay Research Provider",
    service: "web-research",
    priceMon: "0.001",
    reputation: 90,
    quality: 90,
    latencyMs: 1000,
    recipient: config.receivingAddress,
    paymentAmountNative: "1000000000000000",
  }
  const store = createD1PaymentStore(environment.DB)
  return createProviderApp(
    {
      offer,
      verifyPayment: verifyMonadPayment(config, offer),
      consumePayment: store.consume,
      research: researchWithEvidence(config),
    },
    environment.MCPAY_EXECUTE_RATE_LIMITER
  )
}
