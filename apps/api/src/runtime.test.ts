import { afterEach, describe, expect, it, vi } from "vitest"

import { createConfiguredTaskRunner } from "./runtime.js"

const environment = {
  MCPAY_RUNTIME_MODE: "live",
  MCPAY_LLM_API_KEY: "test-key",
  MCPAY_LLM_BASE_URL: "https://llm.test",
  MCPAY_LLM_MODEL: "test-model",
  MCPAY_OFFERS_URL: "https://offers.test",
  MCPAY_MONAD_RPC_URL: "https://rpc.test",
  MCPAY_MONAD_CHAIN_ID: "10143",
  MCPAY_AGENT_PRIVATE_KEY: "0x0123456789012345678901234567890123456789012345678901234567890123",
  MCPAY_PROVIDER_EXECUTION_URL: "https://provider.test",
}

const offer = {
  id: "search-pro",
  providerName: "SearchPro",
  service: "web-research",
  priceMon: "0.0010",
  reputation: 97,
  quality: 95,
  latencyMs: 180,
  recipient: "0x2222222222222222222222222222222222222222",
  paymentAmountNative: "1000000000000000",
} as const

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("live Task runner", () => {
  it("accepts a 402 Payment Request before stopping an over-Budget Task", async () => {
    const fetchMock = vi.fn(async (input: string, _init?: RequestInit) => {
      if (input.startsWith("https://llm.test")) {
        return Response.json({
          choices: [
            { message: { content: JSON.stringify({ service: "web-research", explanation: "Research is needed." }) } },
          ],
        })
      }
      if (input.startsWith("https://offers.test")) return Response.json({ offers: [offer] })
      return Response.json(
        {
          protocolStatus: 402,
          amountMon: offer.priceMon,
          recipient: offer.recipient,
          network: "monad",
          paymentAmountNative: offer.paymentAmountNative,
        },
        { status: 402 }
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await createConfiguredTaskRunner(environment).run({
      goal: "Research Monad ecosystem projects",
      budgetMon: "0.0001",
      requirements: { sourceCount: 5, outputTargetChars: 1000 },
    })

    expect(result.purchase.state).toBe("budget-exceeded")
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1][0]).toContain("sourceCount=5")
    expect(fetchMock.mock.calls[1][0]).toContain("outputTargetChars=1000")
    expect(fetchMock.mock.calls[2][0]).toBe("https://provider.test")
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toMatchObject({
      sourceCount: 5,
      outputTargetChars: 1000,
    })
  })

  it("rejects a Provider Payment Request whose terms differ from the selected Offer", async () => {
    vi.stubGlobal("fetch", async (input: string) => {
      if (input.startsWith("https://llm.test")) {
        return Response.json({
          choices: [
            { message: { content: JSON.stringify({ service: "web-research", explanation: "Research is needed." }) } },
          ],
        })
      }
      if (input.startsWith("https://offers.test")) return Response.json({ offers: [offer] })
      return Response.json(
        {
          protocolStatus: 402,
          amountMon: offer.priceMon,
          recipient: offer.recipient,
          network: "monad",
          paymentAmountNative: "1000000000000000000000",
        },
        { status: 402 }
      )
    })

    await expect(
      createConfiguredTaskRunner(environment).run({
        goal: "Research Monad ecosystem projects",
        budgetMon: "0.10",
        requirements: { sourceCount: 5, outputTargetChars: 1000 },
      })
    ).rejects.toThrow("Provider Payment Request does not match the selected Offer")
  })
})
