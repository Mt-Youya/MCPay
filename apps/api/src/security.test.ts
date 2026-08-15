import { afterEach, describe, expect, it, vi } from "vitest"

import { createConfiguredApiSecurity } from "./security.js"

afterEach(() => vi.unstubAllGlobals())

describe("Task Turnstile verification", () => {
  const environment = {
    MCPAY_RUNTIME_MODE: "live",
    MCPAY_TURNSTILE_SECRET: "test-secret",
    MCPAY_TURNSTILE_HOSTNAMES: "mcpay.yonjay.me",
  }

  it("accepts a verified token with the expected action and hostname", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ success: true, action: "task-submit", hostname: "mcpay.yonjay.me" })
    )
    vi.stubGlobal("fetch", fetchMock)

    const verified = await createConfiguredApiSecurity(environment).verifyTaskTurnstile?.("token", "203.0.113.10")

    expect(verified).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({
        method: "POST",
        body: new URLSearchParams({ secret: "test-secret", response: "token", remoteip: "203.0.113.10" }),
      })
    )
  })

  it("rejects a token for another hostname", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ success: true, action: "task-submit", hostname: "localhost" }))

    await expect(createConfiguredApiSecurity(environment).verifyTaskTurnstile?.("token", "203.0.113.10")).resolves.toBe(
      false
    )
  })
})
