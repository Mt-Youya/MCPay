import { env } from "cloudflare:test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createD1PaymentStore, createProviderApp, type PaymentProof } from "./index.js"

const offer = {
  id: "research-v1",
  providerName: "Research Provider",
  service: "web-research",
  priceMon: "0.001",
  reputation: 90,
  quality: 90,
  latencyMs: 1000,
  recipient: "0x1111111111111111111111111111111111111111",
  paymentAmountNative: "1000000000000000",
} as const

const proof: PaymentProof = {
  transactionId: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  recipient: offer.recipient,
  paymentAmountNative: offer.paymentAmountNative,
}

const request = (headers?: HeadersInit) =>
  new Request("http://provider.test/execute", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ goal: "Research Monad", service: "web-research" }),
  })

afterEach(() => vi.restoreAllMocks())

beforeEach(async () => {
  await env.DB.exec("DROP TABLE IF EXISTS payment_consumptions")
  await env.DB.exec(
    "CREATE TABLE payment_consumptions (transaction_id TEXT PRIMARY KEY NOT NULL, consumed_at TEXT NOT NULL)"
  )
})

describe("MCPay Research Provider", () => {
  it("limits each API egress IP to 30 Execution requests per minute", async () => {
    let requests = 0
    const rateLimiter = { limit: vi.fn(async () => ({ success: ++requests <= 30 })) }
    const app = createProviderApp(
      {
        offer,
        verifyPayment: vi.fn(async () => undefined),
        consumePayment: vi.fn(async () => true),
        research: vi.fn(async () => ({ result: "unused", citations: [] })),
      },
      rateLimiter
    )

    for (let attempt = 0; attempt < 30; attempt += 1) {
      expect((await app.request(request({ "cf-connecting-ip": "203.0.113.10" }))).status).toBe(402)
    }

    const limited = await app.request(request({ "cf-connecting-ip": "203.0.113.10" }))

    expect(limited.status).toBe(429)
    expect(limited.headers.get("retry-after")).toBe("60")
  })

  it("issues a 402 Payment Request with its exact MON Settlement Amount", async () => {
    const app = createProviderApp({
      offer,
      verifyPayment: vi.fn(async () => undefined),
      consumePayment: vi.fn(async () => true),
      research: vi.fn(async () => ({ result: "unused", citations: [] })),
    })

    const response = await app.request(request())

    expect(response.status).toBe(402)
    await expect(response.json()).resolves.toMatchObject({
      protocolStatus: 402,
      amountMon: "0.001",
      recipient: offer.recipient,
      paymentAmountNative: offer.paymentAmountNative,
    })
  })

  it("executes once after verified Payment and returns source citations", async () => {
    const store = createD1PaymentStore(env.DB)
    const research = vi.fn(async () => ({
      result: "Monad has a public testnet.",
      citations: [{ title: "Monad docs", url: "https://docs.monad.xyz/" }],
    }))
    const app = createProviderApp({
      offer,
      verifyPayment: vi.fn(async () => undefined),
      consumePayment: store.consume,
      research,
    })
    const headers = {
      "x-payment-tx": proof.transactionId,
      "x-payment-recipient": proof.recipient,
      "x-payment-amount": proof.paymentAmountNative,
    }

    const response = await app.request(request(headers))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      paymentVerified: true,
      result: "Monad has a public testnet.",
      citations: [{ title: "Monad docs", url: "https://docs.monad.xyz/" }],
    })
    expect(research).toHaveBeenCalledOnce()
  })

  it("streams research chunks and source citations after verified Payment", async () => {
    const app = createProviderApp({
      offer,
      verifyPayment: vi.fn(async () => undefined),
      consumePayment: vi.fn(async () => true),
      research: vi.fn(async () => ({ result: "unused", citations: [] })),
      researchStream: async (_goal, onChunk) => {
        await onChunk("Monad ")
        await onChunk("research")
        return { result: "Monad research", citations: [{ title: "Monad docs", url: "https://docs.monad.xyz/" }] }
      },
    })
    const response = await app.request(
      request({
        accept: "application/x-ndjson",
        "x-payment-tx": proof.transactionId,
        "x-payment-recipient": proof.recipient,
        "x-payment-amount": proof.paymentAmountNative,
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("application/x-ndjson")
    await expect(response.arrayBuffer().then((body) => new TextDecoder().decode(body))).resolves.toBe(
      '{"type":"chunk","content":"Monad "}\n' +
        '{"type":"chunk","content":"research"}\n' +
        '{"type":"result","result":"Monad research","citations":[{"title":"Monad docs","url":"https://docs.monad.xyz/"}]}\n'
    )
  })

  it("rejects a replayed Payment Proof before a second Execution", async () => {
    const store = createD1PaymentStore(env.DB)
    const research = vi.fn(async () => ({ result: "Research complete.", citations: [] }))
    const app = createProviderApp({
      offer,
      verifyPayment: vi.fn(async () => undefined),
      consumePayment: store.consume,
      research,
    })
    const headers = {
      "x-payment-tx": proof.transactionId,
      "x-payment-recipient": proof.recipient,
      "x-payment-amount": proof.paymentAmountNative,
    }

    await app.request(request(headers))
    const replay = await app.request(request(headers))

    expect(replay.status).toBe(409)
    expect(research).toHaveBeenCalledOnce()
  })
})
