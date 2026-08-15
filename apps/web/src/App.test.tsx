import "@testing-library/jest-dom/vitest"

import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createApp } from "@mcpay/api"

import { App } from "./App"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("MCPay Task golden path", () => {
  it("shows the selected Provider after a User submits a Task", async () => {
    const api = createApp()
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(typeof input === "string" ? input : input.toString(), "http://mcpay.local")
      return api.request(path.pathname, init)
    })
    const user = userEvent.setup()

    render(<App />)

    await user.type(screen.getByLabelText("Task goal"), "Research Monad ecosystem projects")
    await user.clear(screen.getByLabelText("Task Budget"))
    await user.type(screen.getByLabelText("Task Budget"), "0.10")
    await user.click(screen.getByRole("button", { name: "Run Agent" }))

    expect(await screen.findByText("SearchPro selected")).toBeVisible()
    expect(screen.getByText("Web research")).toBeVisible()
    expect(screen.getByText("SearchCheap")).toBeVisible()
    expect(screen.getByText(/Reputation 97 · Quality 95 · 180 ms/)).toBeVisible()
  })

  it("shows a verified Payment and paid Execution within the Task Budget", async () => {
    const api = createApp()
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(typeof input === "string" ? input : input.toString(), "http://mcpay.local")
      return api.request(path.pathname, init)
    })
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole("button", { name: "Run Agent" }))

    expect(await screen.findByText("HTTP 402 · Payment Required")).toBeVisible()
    expect(screen.getByText("Payment confirmed")).toBeVisible()
    expect(screen.getByText("Provider verified payment")).toBeVisible()
    expect(screen.getByText("Execution complete")).toBeVisible()
    expect(screen.getByText("Human approvals: 0")).toBeVisible()
  })

  it("does not create a Payment when the selected Offer exceeds the Task Budget", async () => {
    const api = createApp()
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(typeof input === "string" ? input : input.toString(), "http://mcpay.local")
      return api.request(path.pathname, init)
    })
    const user = userEvent.setup()

    render(<App />)

    await user.clear(screen.getByLabelText("Task Budget"))
    await user.type(screen.getByLabelText("Task Budget"), "0.0001")
    await user.click(screen.getByRole("button", { name: "Run Agent" }))

    expect(
      await screen.findByText("The selected Offer exceeds this Task Budget. No Payment or Execution was created.")
    ).toBeVisible()
    expect(screen.queryByText("Payment confirmed")).not.toBeInTheDocument()
    expect(screen.getByText("Spent: $0.0000")).toBeVisible()
  })

  it("shows a clear Provider failure instead of a completed Execution", async () => {
    const api = createApp({
      run: async () => {
        throw new Error("Provider did not verify Payment before Execution")
      },
    })
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(typeof input === "string" ? input : input.toString(), "http://mcpay.local")
      return api.request(path.pathname, init)
    })
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole("button", { name: "Run Agent" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Provider did not verify Payment before Execution")
    expect(screen.queryByText("Execution complete")).not.toBeInTheDocument()
  })

  it("shows when no purchasable Offer supports the planned Service", async () => {
    const api = createApp({
      run: async () => {
        throw new Error("No purchasable Offer supports this Service.")
      },
    })
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(typeof input === "string" ? input : input.toString(), "http://mcpay.local")
      return api.request(path.pathname, init)
    })
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole("button", { name: "Run Agent" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("No purchasable Offer supports this Service.")
  })
})
