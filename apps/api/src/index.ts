import { Hono } from "hono"

import { canAfford, rankOffers, type Offer } from "@mcpay/commerce"

const offers: Offer[] = [
  {
    id: "search-cheap",
    providerName: "SearchCheap",
    service: "web-research",
    priceUsd: "0.0005",
    reputation: 82,
    quality: 80,
    latencyMs: 200,
    recipient: "0x1111111111111111111111111111111111111111",
    paymentAmountNative: "1000000000000000",
  },
  {
    id: "search-pro",
    providerName: "SearchPro",
    service: "web-research",
    priceUsd: "0.0010",
    reputation: 97,
    quality: 95,
    latencyMs: 180,
    recipient: "0x2222222222222222222222222222222222222222",
    paymentAmountNative: "1000000000000000",
  },
]

export type CreateTask = {
  goal?: unknown
  budgetUsd?: unknown
}

export type TaskResult = {
  task: { id: string; goal: string; budgetUsd: string }
  plan: { service: string; label: string; explanation: string; source: "deterministic" | "llm" }
  ranking: ReturnType<typeof rankOffers>
  integration: { planner: "deterministic" | "llm"; settlement: "demo" | "monad"; provider: "demo" | "remote" }
  economics: { spentUsd: string; servicesPurchased: number; humanApprovals: number }
  purchase:
    | {
        state: "completed"
        paymentRequest: {
          protocolStatus: number
          amountUsd: string
          recipient: string
          network: string
          paymentAmountNative: string
        }
        payment: { state: "confirmed"; transactionId: string }
        providerVerification: "verified"
        execution: { state: "completed"; result: string }
      }
    | { state: "budget-exceeded"; message: string }
}

export type TaskRunner = {
  run: (task: { goal: string; budgetUsd: string }) => Promise<TaskResult>
}

export const createDemoTaskRunner = (): TaskRunner => ({
  async run(task) {
    const ranking = rankOffers(offers)
    const selectedOffer = ranking.selected.offer
    const canPurchase = canAfford(task.budgetUsd, selectedOffer.priceUsd)

    return {
      task: { id: "task-demo-001", ...task },
      plan: {
        service: "web-research",
        label: "Web research",
        explanation: "This Task needs research from an external Service.",
        source: "deterministic",
      },
      ranking,
      integration: { planner: "deterministic", settlement: "demo", provider: "demo" },
      economics: canPurchase
        ? { spentUsd: selectedOffer.priceUsd, servicesPurchased: 1, humanApprovals: 0 }
        : { spentUsd: "0.0000", servicesPurchased: 0, humanApprovals: 0 },
      purchase: canPurchase
        ? {
            state: "completed",
            paymentRequest: {
              protocolStatus: 402,
              amountUsd: selectedOffer.priceUsd,
              recipient: selectedOffer.recipient,
              network: "monad",
              paymentAmountNative: selectedOffer.paymentAmountNative,
            },
            payment: { state: "confirmed", transactionId: "demo-payment-task-demo-001" },
            providerVerification: "verified",
            execution: {
              state: "completed",
              result: "Five Monad ecosystem projects were researched through a paid Web research Execution.",
            },
          }
        : {
            state: "budget-exceeded",
            message: "The selected Offer exceeds this Task Budget. No Payment or Execution was created.",
          },
    }
  },
})

export const createApp = (runner: TaskRunner = createDemoTaskRunner()) => {
  const app = new Hono()

  app.post("/api/tasks", async (context) => {
    const body = (await context.req.json()) as CreateTask

    if (typeof body.goal !== "string" || body.goal.trim().length === 0) {
      return context.json({ message: "A Task goal is required." }, 400)
    }

    if (typeof body.budgetUsd !== "string" || Number(body.budgetUsd) <= 0) {
      return context.json({ message: "A positive Budget is required." }, 400)
    }

    try {
      return context.json(await runner.run({ goal: body.goal.trim(), budgetUsd: body.budgetUsd }))
    } catch (caught) {
      return context.json(
        { message: caught instanceof Error ? caught.message : "The Task could not be completed." },
        502
      )
    }
  })

  return app
}
