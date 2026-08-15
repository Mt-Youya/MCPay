import { Hono, type Context } from "hono"

import { canAfford, rankOffers, type Offer } from "@mcpay/commerce"

import { createFixedWindowRateLimiter, requestClientIp, type TaskRateLimiter } from "./rate-limit.js"
import type { WalletAccess, WalletAddress } from "./wallet-access.js"

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
  sourceCount?: unknown
  outputTargetChars?: unknown
}

export type ResearchRequirements = { sourceCount: number; outputTargetChars: number }

export const defaultResearchRequirements: ResearchRequirements = { sourceCount: 5, outputTargetChars: 1000 }

export type TaskResult = {
  task: { id: string; goal: string; budgetMon: string; requirements: ResearchRequirements }
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
    | { state: "budget-exceeded" | "quota-exceeded"; message: string }
}

export type TaskProgress = {
  stage: "planning" | "offers" | "payment" | "execution"
  message: string
  content?: string
}

export type TaskProgressListener = (progress: TaskProgress) => void | Promise<void>

export type TaskRunner = {
  run: (
    task: ValidTask,
    onProgress?: TaskProgressListener,
    authorizePurchase?: (amountMon: string) => Promise<boolean>
  ) => Promise<TaskResult>
}

export type ApiSecurity = {
  taskRateLimiter: TaskRateLimiter
  verifyTaskTurnstile?: (token: string | undefined, clientIp: string) => Promise<boolean>
  walletAccess?: WalletAccess
  requireWalletAuth?: boolean
}

export const createDemoTaskRunner = (): TaskRunner => ({
  async run(task, onProgress, authorizePurchase) {
    await onProgress?.({ stage: "planning", message: "Planning Task" })
    const ranking = rankOffers(offers)
    const selectedOffer = ranking.selected.offer
    const canPurchase = canAfford(task.budgetMon, selectedOffer.priceMon)
    await onProgress?.({ stage: "offers", message: `${selectedOffer.providerName} selected` })

    if (canPurchase && authorizePurchase && !(await authorizePurchase(selectedOffer.priceMon))) {
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
        economics: { spentMon: "0.0000", servicesPurchased: 0, humanApprovals: 0 },
        purchase: { state: "quota-exceeded", message: "This wallet has reached its daily MON spending limit." },
      }
    }

    if (canPurchase) {
      await onProgress?.({ stage: "payment", message: "Monad payment confirmed" })
      await onProgress?.({ stage: "execution", message: "Provider execution complete" })
    }

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

type ValidTask = { goal: string; budgetMon: string; requirements: ResearchRequirements }
type ValidatedTask = { task: ValidTask; walletAddress?: WalletAddress }

const researchRequirements = (body: CreateTask): ResearchRequirements | null => {
  const sourceCount = body.sourceCount ?? defaultResearchRequirements.sourceCount
  const outputTargetChars = body.outputTargetChars ?? defaultResearchRequirements.outputTargetChars
  if (
    typeof sourceCount !== "number" ||
    !Number.isInteger(sourceCount) ||
    sourceCount < 1 ||
    sourceCount > 10 ||
    typeof outputTargetChars !== "number" ||
    !Number.isInteger(outputTargetChars) ||
    outputTargetChars < 250 ||
    outputTargetChars > 4000
  ) {
    return null
  }
  return { sourceCount, outputTargetChars }
}

const cookieValue = (request: Request, name: string) =>
  request.headers
    .get("cookie")
    ?.split(";")
    .map((value) => value.trim().split("=", 2))
    .find(([key]) => key === name)?.[1]

const validateTask = async (context: Context, security: ApiSecurity): Promise<ValidatedTask | Response> => {
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
  const requirements = researchRequirements(body)
  if (!requirements) {
    return context.json({ message: "Source count must be 1–10 and output length must be 250–4000 characters." }, 400)
  }
  const session = await security.walletAccess?.session(cookieValue(context.req.raw, "mcpay_session"))
  if (security.requireWalletAuth && !session)
    return context.json({ message: "Connect and sign in with a wallet first." }, 401)
  if (session && security.requireWalletAuth && !(await security.walletAccess?.claimTask(session.walletAddress))) {
    return context.json({ message: "This wallet has reached its daily task limit." }, 429)
  }
  return {
    task: { goal: body.goal.trim(), budgetMon: body.budgetMon, requirements },
    walletAddress: session?.walletAddress,
  }
}

const streamTask = (
  context: Context,
  runner: TaskRunner,
  task: ValidTask,
  authorizePurchase?: (amountMon: string) => Promise<boolean>
) => {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: "progress" | "result" | "error", data: TaskProgress | TaskResult | { message: string }) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      void (async () => {
        try {
          const result = await runner.run(task, async (progress) => send("progress", progress), authorizePurchase)
          send("result", result)
        } catch (caught) {
          send("error", { message: caught instanceof Error ? caught.message : "The Task could not be completed." })
        } finally {
          controller.close()
        }
      })()
    },
  })

  return context.body(stream, 200, {
    "cache-control": "no-cache",
    "content-type": "text/event-stream; charset=utf-8",
  })
}

export const createApp = (
  runner: TaskRunner = createDemoTaskRunner(),
  security: ApiSecurity = { taskRateLimiter: createFixedWindowRateLimiter(10, 60_000) }
) => {
  const app = new Hono()

  app.post("/api/auth/nonce", async (context) => {
    const rateLimit = await security.taskRateLimiter(requestClientIp(context.req.raw))
    if (!rateLimit.allowed) {
      context.header("Retry-After", String(rateLimit.retryAfterSeconds))
      return context.json({ message: "Too many authentication requests. Try again later." }, 429)
    }
    if (!security.walletAccess) return context.json({ message: "Wallet authentication is not configured." }, 404)
    const body = (await context.req.json()) as { address?: unknown }
    const challenge = await security.walletAccess.createChallenge({
      address: body.address,
      hostname: new URL(context.req.url).hostname,
    })
    if (!challenge) return context.json({ message: "A valid wallet address is required." }, 400)
    return context.json(challenge)
  })

  app.post("/api/auth/session", async (context) => {
    if (!security.walletAccess) return context.json({ message: "Wallet authentication is not configured." }, 404)
    const body = (await context.req.json()) as { address?: unknown; nonce?: unknown; signature?: unknown }
    const created = await security.walletAccess.createSession({
      address: body.address,
      nonce: body.nonce,
      signature: body.signature,
      hostname: new URL(context.req.url).hostname,
    })
    if (!created) return context.json({ message: "Wallet signature could not be verified." }, 401)
    context.header(
      "set-cookie",
      `mcpay_session=${created.token}; HttpOnly; Path=/; SameSite=Strict; Secure; Max-Age=${Math.floor(
        (Date.parse(created.expiresAt) - Date.now()) / 1_000
      )}`
    )
    return context.json({
      walletAddress: created.session.walletAddress,
      quota: await security.walletAccess.quotaFor(created.session.walletAddress),
    })
  })

  app.get("/api/auth/session", async (context) => {
    if (!security.walletAccess) return context.json({ message: "Wallet authentication is not configured." }, 404)
    const session = await security.walletAccess.session(cookieValue(context.req.raw, "mcpay_session"))
    if (!session) return context.json({ message: "No active wallet session." }, 401)
    return context.json({
      walletAddress: session.walletAddress,
      quota: await security.walletAccess.quotaFor(session.walletAddress),
    })
  })

  app.post("/api/auth/logout", async (context) => {
    await security.walletAccess?.deleteSession(cookieValue(context.req.raw, "mcpay_session"))
    context.header("set-cookie", "mcpay_session=; HttpOnly; Path=/; SameSite=Strict; Secure; Max-Age=0")
    return context.body(null, 204)
  })

  app.post("/api/tasks", async (context) => {
    const validated = await validateTask(context, security)
    if (validated instanceof Response) return validated
    const authorizePurchase =
      validated.walletAddress && security.walletAccess
        ? (amountMon: string) => security.walletAccess!.reserveSpend(validated.walletAddress!, amountMon)
        : undefined

    try {
      return context.json(await runner.run(validated.task, undefined, authorizePurchase))
    } catch (caught) {
      return context.json(
        { message: caught instanceof Error ? caught.message : "The Task could not be completed." },
        502
      )
    }
  })

  app.post("/api/tasks/stream", async (context) => {
    const validated = await validateTask(context, security)
    if (validated instanceof Response) return validated
    const authorizePurchase =
      validated.walletAddress && security.walletAccess
        ? (amountMon: string) => security.walletAccess!.reserveSpend(validated.walletAddress!, amountMon)
        : undefined
    return streamTask(context, runner, validated.task, authorizePurchase)
  })

  return app
}
