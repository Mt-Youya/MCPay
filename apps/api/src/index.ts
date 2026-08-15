import { Hono } from "hono"

import { canAfford, rankOffers, type Offer } from "@mcpay/commerce"

import { createFixedWindowRateLimiter, requestClientIp, type TaskRateLimiter } from "./rate-limit.js"

const offers: Offer[] = [
  {
    id: "search-cheap",
    providerName: "SearchCheap",
    service: "web-research",
    priceMon: "0.0005",
    reputation: 82,
    quality: 80,
    latencyMs: 200,
    recipient: "0x1111111111111111111111111111111111111111",
    paymentAmountNative: "500000000000000",
  },
  {
    id: "search-pro",
    providerName: "SearchPro",
    service: "web-research",
    priceMon: "0.0010",
    reputation: 97,
    quality: 95,
    latencyMs: 180,
    recipient: "0x2222222222222222222222222222222222222222",
    paymentAmountNative: "1000000000000000",
  },
]

export type CreateTask = {
  goal?: unknown
  budgetMon?: unknown
}

export type TaskResult = {
  task: { id: string; goal: string; budgetMon: string }
  plan: { service: string; label: string; explanation: string; source: "deterministic" | "llm" }
  ranking: ReturnType<typeof rankOffers>
  integration: { planner: "deterministic" | "llm"; settlement: "demo" | "monad"; provider: "demo" | "remote" }
  economics: { spentMon: string; servicesPurchased: number; humanApprovals: number }
  purchase:
    | {
        state: "completed"
        paymentRequest: {
          protocolStatus: number
          amountMon: string
          recipient: string
          network: string
          paymentAmountNative: string
        }
        payment: { state: "confirmed"; transactionId: string }
        providerVerification: "verified"
        execution: { state: "completed"; result: string; citations: Array<{ title: string; url: string }> }
      }
    | { state: "budget-exceeded"; message: string }
}

export type TaskRunner = {
  run: (task: { goal: string; budgetMon: string }) => Promise<TaskResult>
}

export type ApiSecurity = {
  taskRateLimiter: TaskRateLimiter
  verifyTaskTurnstile?: (token: string | undefined, clientIp: string) => Promise<boolean>
}

export const createDemoTaskRunner = (): TaskRunner => ({
  async run(task) {
    const ranking = rankOffers(offers)
    const selectedOffer = ranking.selected.offer
    const canPurchase = canAfford(task.budgetMon, selectedOffer.priceMon)

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
        ? { spentMon: selectedOffer.priceMon, servicesPurchased: 1, humanApprovals: 0 }
        : { spentMon: "0.0000", servicesPurchased: 0, humanApprovals: 0 },
      purchase: canPurchase
        ? {
            state: "completed",
            paymentRequest: {
              protocolStatus: 402,
              amountMon: selectedOffer.priceMon,
              recipient: selectedOffer.recipient,
              network: "monad",
              paymentAmountNative: selectedOffer.paymentAmountNative,
            },
            payment: { state: "confirmed", transactionId: "demo-payment-task-demo-001" },
            providerVerification: "verified",
            execution: {
              state: "completed",
              result: "Five Monad ecosystem projects were researched through a paid Web research Execution.",
              citations: [{ title: "Monad", url: "https://monad.xyz/" }],
            },
          }
        : {
            state: "budget-exceeded",
            message: "The selected Offer exceeds this Task Budget. No Payment or Execution was created.",
          },
    }
  },
})

export const createApp = (
  runner: TaskRunner = createDemoTaskRunner(),
  security: ApiSecurity = { taskRateLimiter: createFixedWindowRateLimiter(10, 60_000) }
) => {
  const app = new Hono()

  app.post("/api/tasks", async (context) => {
    const rateLimit = await security.taskRateLimiter(requestClientIp(context.req.raw))
    if (!rateLimit.allowed) {
      context.header("Retry-After", String(rateLimit.retryAfterSeconds))
      return context.json({ message: "Too many Task requests. Try again later." }, 429)
    }

    if (
      !(await security.verifyTaskTurnstile?.(context.req.header("x-turnstile-token"), requestClientIp(context.req.raw)))
    ) {
      if (security.verifyTaskTurnstile) return context.json({ message: "Task verification failed." }, 403)
    }

    const body = (await context.req.json()) as CreateTask

    if (typeof body.goal !== "string" || body.goal.trim().length === 0) {
      return context.json({ message: "A Task goal is required." }, 400)
    }

    if (typeof body.budgetMon !== "string" || Number(body.budgetMon) <= 0) {
      return context.json({ message: "A positive Budget is required." }, 400)
    }

    try {
      return context.json(await runner.run({ goal: body.goal.trim(), budgetMon: body.budgetMon }))
    } catch (caught) {
      return context.json(
        { message: caught instanceof Error ? caught.message : "The Task could not be completed." },
        502
      )
    }
  })

  return app
}
