import { createPublicClient, createWalletClient, defineChain, http, type Address } from "viem"
import { privateKeyToAccount } from "viem/accounts"

import { canAfford, rankOffers, type Offer } from "@mcpay/commerce"

import { createDemoTaskRunner, type TaskResult, type TaskRunner } from "./index.js"

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

type LlmCompletion = { choices?: Array<{ message?: { content?: string } }> }
type RemoteExecution = { paymentVerified?: boolean; result?: string }
type PaymentRequest = {
  protocolStatus: 402
  amountUsd: string
  recipient: `0x${string}`
  network: "monad"
  paymentAmountNative: string
}

const required = (environment: NodeJS.ProcessEnv, name: keyof LiveConfig) => {
  const environmentName = `MCPAY_${name.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`
  const value = environment[environmentName]
  if (!value) throw new Error(`${name} is required when MCPAY_RUNTIME_MODE=live`)
  return value
}

const liveConfig = (environment: NodeJS.ProcessEnv): LiveConfig => ({
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
  task: { goal: string; budgetUsd: string },
  offer: Offer
): Promise<PaymentRequest> => {
  const response = await fetch(config.providerExecutionUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ goal: task.goal, budgetUsd: task.budgetUsd, service: offer.service }),
  })
  if (response.status !== 402)
    throw new Error(`Provider did not return a Payment Request (received ${response.status})`)
  const paymentRequest = (await response.json()) as Partial<PaymentRequest>
  if (
    paymentRequest.protocolStatus !== 402 ||
    paymentRequest.amountUsd !== offer.priceUsd ||
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
  task: { goal: string; budgetUsd: string },
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
    body: JSON.stringify({ goal: task.goal, budgetUsd: task.budgetUsd, service: offer.service }),
  })
  if (!response.ok) throw new Error(`Provider Execution failed with ${response.status}`)
  const execution = (await response.json()) as RemoteExecution
  if (execution.paymentVerified !== true || typeof execution.result !== "string") {
    throw new Error("Provider did not verify Payment before Execution")
  }
  return execution.result
}

const createLiveTaskRunner = (config: LiveConfig): TaskRunner => ({
  async run(task): Promise<TaskResult> {
    const [plan, offers] = await Promise.all([planTask(config, task.goal), fetchOffers(config.offersUrl)])
    const matchingOffers = offers.filter((offer) => offer.service === plan.service)
    if (matchingOffers.length === 0) throw new Error("No purchasable Offer supports this Service.")
    const ranking = rankOffers(matchingOffers)
    const selectedOffer = ranking.selected.offer

    const paymentRequest = await requestPayment(config, task, selectedOffer)

    if (!canAfford(task.budgetUsd, paymentRequest.amountUsd)) {
      return {
        task: { id: crypto.randomUUID(), ...task },
        plan,
        ranking,
        integration: { planner: "llm", settlement: "monad", provider: "remote" },
        economics: { spentUsd: "0.0000", servicesPurchased: 0, humanApprovals: 0 },
        purchase: {
          state: "budget-exceeded",
          message: "The selected Offer exceeds this Task Budget. No Payment or Execution was created.",
        },
      }
    }

    const transactionId = await settleOnMonad(config, paymentRequest)
    const result = await executeRemotely(config, task, selectedOffer, paymentRequest, transactionId)
    return {
      task: { id: crypto.randomUUID(), ...task },
      plan,
      ranking,
      integration: { planner: "llm", settlement: "monad", provider: "remote" },
      economics: { spentUsd: selectedOffer.priceUsd, servicesPurchased: 1, humanApprovals: 0 },
      purchase: {
        state: "completed",
        paymentRequest,
        payment: { state: "confirmed", transactionId },
        providerVerification: "verified",
        execution: { state: "completed", result },
      },
    }
  },
})

export const createConfiguredTaskRunner = (environment: NodeJS.ProcessEnv = process.env): TaskRunner => {
  if (environment.MCPAY_RUNTIME_MODE !== "live") return createDemoTaskRunner()
  return createLiveTaskRunner(liveConfig(environment))
}
