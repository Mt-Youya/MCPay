import { createFixedWindowRateLimiter } from "./rate-limit.js"
import type { ApiSecurity } from "./index.js"
import type { RuntimeEnvironment } from "./runtime.js"
import type { TaskRateLimiter } from "./rate-limit.js"
import { createWalletAccess, type WalletAccessDatabase } from "./wallet-access.js"

type TurnstileResponse = { success?: unknown; action?: unknown; hostname?: unknown }

type TurnstileConfig = {
  secret: string
  expectedHostnames: Set<string>
}

type SecurityEnvironment = RuntimeEnvironment & {
  MCPAY_API_DB?: WalletAccessDatabase
  MCPAY_TURNSTILE_SECRET?: string
  MCPAY_TURNSTILE_HOSTNAMES?: string
}

const required = (environment: SecurityEnvironment, name: "MCPAY_TURNSTILE_SECRET" | "MCPAY_TURNSTILE_HOSTNAMES") => {
  const value = environment[name]
  if (!value) throw new Error(`${name} is required when MCPAY_RUNTIME_MODE=live`)
  return value
}

const taskTurnstileVerifier = (config: TurnstileConfig) => async (token: string | undefined, clientIp: string) => {
  if (!token || token.length > 2048) return false

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({ secret: config.secret, response: token, remoteip: clientIp }),
    })
    if (!response.ok) return false

    const result = (await response.json()) as TurnstileResponse
    return (
      result.success === true &&
      result.action === "task-submit" &&
      config.expectedHostnames.has(String(result.hostname))
    )
  } catch {
    return false
  }
}

export const createConfiguredApiSecurity = (
  environment: SecurityEnvironment = process.env,
  taskRateLimiter: TaskRateLimiter = createFixedWindowRateLimiter(10, 60_000)
): ApiSecurity => {
  if (environment.MCPAY_RUNTIME_MODE !== "live") return { taskRateLimiter }

  const expectedHostnames = new Set(
    required(environment, "MCPAY_TURNSTILE_HOSTNAMES")
      .split(",")
      .map((hostname) => hostname.trim())
      .filter(Boolean)
  )
  if (expectedHostnames.size === 0) throw new Error("MCPAY_TURNSTILE_HOSTNAMES must include at least one hostname")
  return {
    taskRateLimiter,
    verifyTaskTurnstile: taskTurnstileVerifier({
      secret: required(environment, "MCPAY_TURNSTILE_SECRET"),
      expectedHostnames,
    }),
    ...(environment.MCPAY_API_DB
      ? { walletAccess: createWalletAccess({ database: environment.MCPAY_API_DB }), requireWalletAuth: true }
      : {}),
  }
}
