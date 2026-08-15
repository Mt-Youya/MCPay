import { describe, expect, it, vi } from "vitest"

import { createApp } from "./index.js"
import { createFixedWindowRateLimiter } from "./rate-limit.js"

const taskRequest = (ip: string, path = "/api/tasks") =>
  new Request(`http://api.test${path}`, {
    method: "POST",
    headers: { "cf-connecting-ip": ip, "content-type": "application/json" },
    body: JSON.stringify({ goal: "Research Monad", budgetMon: "0.01" }),
  })

describe("Task API rate limiting", () => {
  it("limits each client IP to 10 Task requests per minute", async () => {
    const app = createApp(undefined, { taskRateLimiter: createFixedWindowRateLimiter(10, 60_000, () => 0) })

    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await app.request(taskRequest("203.0.113.10"))).status).toBe(200)
    }

    const limited = await app.request(taskRequest("203.0.113.10"))

    expect(limited.status).toBe(429)
    expect(limited.headers.get("retry-after")).toBe("60")
    await expect(limited.json()).resolves.toEqual({ message: "Too many Task requests. Try again later." })
  })

  it("keeps rate limits separate for different client IPs", async () => {
    const app = createApp(undefined, { taskRateLimiter: createFixedWindowRateLimiter(1, 60_000, () => 0) })

    expect((await app.request(taskRequest("203.0.113.10"))).status).toBe(200)
    expect((await app.request(taskRequest("203.0.113.11"))).status).toBe(200)
  })

  it("rejects a Task before execution when Turnstile verification fails", async () => {
    const run = vi.fn(async () => ({}) as never)
    const verifyTaskTurnstile = vi.fn(async () => false)
    const app = createApp(
      { run },
      { taskRateLimiter: createFixedWindowRateLimiter(10, 60_000, () => 0), verifyTaskTurnstile }
    )

    const response = await app.request(taskRequest("203.0.113.10"))

    expect(response.status).toBe(403)
    expect(verifyTaskTurnstile).toHaveBeenCalledWith(undefined, "203.0.113.10")
    expect(run).not.toHaveBeenCalled()
  })

  it("runs a Task after Turnstile verification succeeds", async () => {
    const run = vi.fn(async () => ({ task: "created" }) as never)
    const app = createApp(
      { run },
      {
        taskRateLimiter: createFixedWindowRateLimiter(10, 60_000, () => 0),
        verifyTaskTurnstile: async () => true,
      }
    )

    const response = await app.request(taskRequest("203.0.113.10"), {
      headers: { "x-turnstile-token": "verified-token" },
    })

    expect(response.status).toBe(200)
    expect(run).toHaveBeenCalledOnce()
  })

  it("streams Task lifecycle events before the final result", async () => {
    const app = createApp()

    const response = await app.request(taskRequest("203.0.113.10", "/api/tasks/stream"))

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/event-stream")
    const events = (await response.text())
      .trim()
      .split("\n\n")
      .map((frame) => {
        const event = frame.match(/^event: (.+)$/m)?.[1]
        const data = JSON.parse(frame.match(/^data: (.+)$/m)?.[1] ?? "{}") as { stage?: string }
        return { event, data }
      })
    expect(events[0]).toMatchObject({ event: "progress", data: { stage: "planning" } })
    expect(events.some((event) => event.event === "progress" && event.data.stage === "payment")).toBe(true)
    expect(events.at(-1)).toMatchObject({ event: "result" })
  })
})
