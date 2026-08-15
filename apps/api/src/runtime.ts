import { createPublicClient, createWalletClient, defineChain, http, type Address } from "viem"
import { privateKeyToAccount } from "viem/accounts"

import { canAfford, rankOffers, type Offer } from "@mcpay/commerce"

import { createDemoTaskRunner, type TaskProgressListener, type TaskResult, type TaskRunner } from "./index.js"

type LiveConfig = {
  llmApiKey: string
  llmBaseUrl: string
  llmModel: string
  monadRpcUrl: string
  monadChainId: number
  agentPrivateKey: `0x${string}`
  providerExecutionUrl: string
  offersUrl: string
}

export type RuntimeEnvironment = {
  MCPAY_RUNTIME_MODE?: string
  MCPAY_LLM_API_KEY?: string
  MCPAY_LLM_BASE_URL?: string
  MCPAY_LLM_MODEL?: string
  MCPAY_MONAD_RPC_URL?: string
  MCPAY_MONAD_CHAIN_ID?: string
  MCPAY_AGENT_PRIVATE_KEY?: string
  MCPAY_PROVIDER_EXECUTION_URL?: string
  MCPAY_OFFERS_URL?: string
}

type LlmCompletion = { choices?: Array<{ message?: { content?: string } }> }
type RemoteExecution = {
  paymentVerified?: boolean
  result?: string
  citations?: Array<{ title?: unknown; url?: unknown }>
}
type RemoteStreamData = {
  content?: unknown
  result?: unknown
  citations?: Array<{ title?: unknown; url?: unknown }>
  message?: unknown
}
type PaymentRequest = {
  protocolStatus: 402
  amountMon: string
  recipient: `0x${string}`
  network: "monad"
  paymentAmountNative: string
}

const required = (environment: RuntimeEnvironment, name: keyof LiveConfig) => {
  const environmentName =
    `MCPAY_${name.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}` as keyof RuntimeEnvironment
  const value = environment[environmentName]
  if (!value) throw new Error(`${name} is required when MCPAY_RUNTIME_MODE=live`)
  return value
}

const liveConfig = (environment: RuntimeEnvironment): LiveConfig => ({
  llmApiKey: required(environment, "llmApiKey"),
  llmBaseUrl: required(environment, "llmBaseUrl").replace(/\/$/, ""),
  llmModel: required(environment, "llmModel"),
  monadRpcUrl: required(environment, "monadRpcUrl"),
  monadChainId: Number(required(environment, "monadChainId")),
  agentPrivateKey: required(environment, "agentPrivateKey") as `0x${string}`,
  providerExecutionUrl: required(environment, "providerExecutionUrl"),
  offersUrl: required(environment, "offersUrl"),
})

const fetchOffers = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Offer discovery failed with ${response.status}`)
  const payload = (await response.json()) as { offers?: Offer[] }
  if (!Array.isArray(payload.offers) || payload.offers.length === 0)
    throw new Error("Offer discovery returned no Offers")
  return payload.offers
}

const planTask = async (config: LiveConfig, goal: string) => {
  const response = await fetch(`${config.llmBaseUrl}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${config.llmApiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: config.llmModel,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Return JSON with service and explanation. The only supported service is web-research.",
        },
        { role: "user", content: goal },
      ],
    }),
  })
  if (!response.ok) throw new Error(`LLM planning failed with ${response.status}`)
  const completion = (await response.json()) as LlmCompletion
  const content = completion.choices?.[0]?.message?.content
  if (!content) throw new Error("LLM planning returned no content")
  const plan = JSON.parse(content) as { service?: unknown; explanation?: unknown }
  if (plan.service !== "web-research" || typeof plan.explanation !== "string") {
    throw new Error("LLM planning selected an unsupported Service")
  }
  return { service: plan.service, label: "Web research", explanation: plan.explanation, source: "llm" as const }
}

const requestPayment = async (
  config: LiveConfig,
  task: { goal: string; budgetMon: string },
  offer: Offer
): Promise<PaymentRequest> => {
  const response = await fetch(config.providerExecutionUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ goal: task.goal, budgetMon: task.budgetMon, service: offer.service }),
  })
  if (response.status !== 402)
    throw new Error(`Provider did not return a Payment Request (received ${response.status})`)
  const paymentRequest = (await response.json()) as Partial<PaymentRequest>
  if (
    paymentRequest.protocolStatus !== 402 ||
    paymentRequest.amountMon !== offer.priceMon ||
    paymentRequest.recipient !== offer.recipient ||
    paymentRequest.network !== "monad" ||
    paymentRequest.paymentAmountNative !== offer.paymentAmountNative
  ) {
    throw new Error("Provider Payment Request does not match the selected Offer")
  }
  return paymentRequest as PaymentRequest
}

const settleOnMonad = async (config: LiveConfig, paymentRequest: PaymentRequest) => {
  const chain = defineChain({
    id: config.monadChainId,
    name: "Monad",
    nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: [config.monadRpcUrl] } },
  })
  const account = privateKeyToAccount(config.agentPrivateKey)
  const transport = http(config.monadRpcUrl)
  const wallet = createWalletClient({ account, chain, transport })
  const receiptClient = createPublicClient({ chain, transport })
  const transactionId = await wallet.sendTransaction({
    to: paymentRequest.recipient as Address,
    value: BigInt(paymentRequest.paymentAmountNative),
  })
  const receipt = await receiptClient.waitForTransactionReceipt({ hash: transactionId })
  if (receipt.status !== "success") throw new Error("Monad Payment was not confirmed")
  return transactionId
}

const executeRemotely = async (
  config: LiveConfig,
  task: { goal: string; budgetMon: string },
  offer: Offer,
  paymentRequest: PaymentRequest,
  transactionId: string
) => {
  const response = await fetch(config.providerExecutionUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-payment-tx": transactionId,
      "x-payment-recipient": paymentRequest.recipient,
      "x-payment-amount": paymentRequest.paymentAmountNative,
    },
    body: JSON.stringify({ goal: task.goal, budgetMon: task.budgetMon, service: offer.service }),
  })
  if (!response.ok) throw new Error(`Provider Execution failed with ${response.status}`)
  const execution = (await response.json()) as RemoteExecution
  return validExecution(execution)
}

const validExecution = (execution: RemoteExecution) => {
  if (execution.paymentVerified !== true || typeof execution.result !== "string") {
    throw new Error("Provider did not verify Payment before Execution")
  }
  if (
    !Array.isArray(execution.citations) ||
    execution.citations.some((citation) => typeof citation.title !== "string" || typeof citation.url !== "string")
  ) {
    throw new Error("Provider Execution returned invalid citations")
  }
  return { result: execution.result, citations: execution.citations as Array<{ title: string; url: string }> }
}

const executeRemotelyStream = async (
  config: LiveConfig,
  task: { goal: string; budgetMon: string },
  offer: Offer,
  paymentRequest: PaymentRequest,
  transactionId: string,
  onProgress: TaskProgressListener
) => {
  const response = await fetch(config.providerExecutionUrl, {
    method: "POST",
    headers: {
      accept: "text/event-stream",
      "content-type": "application/json",
      "x-payment-tx": transactionId,
      "x-payment-recipient": paymentRequest.recipient,
      "x-payment-amount": paymentRequest.paymentAmountNative,
    },
    body: JSON.stringify({ goal: task.goal, budgetMon: task.budgetMon, service: offer.service }),
  })
  if (!response.ok) throw new Error(`Provider Execution failed with ${response.status}`)
  if (!response.body) throw new Error("Provider Execution did not return a stream")

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let execution: RemoteExecution | undefined

  const handleEvent = async (frame: string) => {
    const event = frame.match(/^event:\s*(.+)$/m)?.[1]
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n")
    if (!event || !data) return
    let payload: RemoteStreamData
    try {
      payload = JSON.parse(data) as RemoteStreamData
    } catch {
      throw new Error("Provider Execution returned an invalid stream")
    }
    if (event === "chunk" && typeof payload.content === "string") {
      await onProgress({ stage: "execution", message: "Research synthesis", content: payload.content })
      return
    }
    if (event === "error" && typeof payload.message === "string") throw new Error(payload.message)
    if (event === "result") {
      execution = {
        paymentVerified: true,
        result: typeof payload.result === "string" ? payload.result : undefined,
        citations: payload.citations,
      }
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const events = buffer.split(/\r?\n\r?\n/)
      buffer = events.pop() ?? ""
      for (const event of events) await handleEvent(event)
      if (done) break
    }
    if (buffer) await handleEvent(buffer)
  } finally {
    reader.releaseLock()
  }

  if (!execution) throw new Error("Provider Execution stream ended without a result")
  return validExecution(execution)
}

const createLiveTaskRunner = (config: LiveConfig): TaskRunner => ({
  async run(task, onProgress): Promise<TaskResult> {
    await onProgress?.({ stage: "planning", message: "Planning Task and discovering Offers" })
    const [plan, offers] = await Promise.all([planTask(config, task.goal), fetchOffers(config.offersUrl)])
    const matchingOffers = offers.filter((offer) => offer.service === plan.service)
    if (matchingOffers.length === 0) throw new Error("No purchasable Offer supports this Service.")
    const ranking = rankOffers(matchingOffers)
    const selectedOffer = ranking.selected.offer
    await onProgress?.({ stage: "offers", message: `${selectedOffer.providerName} selected` })

    const paymentRequest = await requestPayment(config, task, selectedOffer)

    if (!canAfford(task.budgetMon, paymentRequest.amountMon)) {
      return {
        task: { id: crypto.randomUUID(), ...task },
        plan,
        ranking,
        integration: { planner: "llm", settlement: "monad", provider: "remote" },
        economics: { spentMon: "0.0000", servicesPurchased: 0, humanApprovals: 0 },
        purchase: {
          state: "budget-exceeded",
          message: "The selected Offer exceeds this Task Budget. No Payment or Execution was created.",
        },
      }
    }

    await onProgress?.({ stage: "payment", message: "Submitting Monad payment" })
    const transactionId = await settleOnMonad(config, paymentRequest)
    await onProgress?.({ stage: "payment", message: "Monad payment confirmed" })
    await onProgress?.({ stage: "execution", message: "Provider verified payment; researching" })
    const execution = onProgress
      ? await executeRemotelyStream(config, task, selectedOffer, paymentRequest, transactionId, onProgress)
      : await executeRemotely(config, task, selectedOffer, paymentRequest, transactionId)
    return {
      task: { id: crypto.randomUUID(), ...task },
      plan,
      ranking,
      integration: { planner: "llm", settlement: "monad", provider: "remote" },
      economics: { spentMon: selectedOffer.priceMon, servicesPurchased: 1, humanApprovals: 0 },
      purchase: {
        state: "completed",
        paymentRequest,
        payment: { state: "confirmed", transactionId },
        providerVerification: "verified",
        execution: { state: "completed", ...execution },
      },
    }
  },
})

export const createConfiguredTaskRunner = (environment: RuntimeEnvironment = process.env): TaskRunner => {
  if (environment.MCPAY_RUNTIME_MODE !== "live") return createDemoTaskRunner()
  return createLiveTaskRunner(liveConfig(environment))
}
