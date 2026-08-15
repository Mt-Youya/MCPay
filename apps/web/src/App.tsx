import { useEffect, useRef, useState } from "react"

type TurnstileOptions = {
  sitekey: string
  action: string
  callback: (token: string) => void
  "expired-callback": () => void
  "error-callback": () => void
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileOptions) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

const turnstileSiteKey = "0x4AAAAAAEQi5uy8WjbcalUB"

type TaskView = {
  plan: {
    label: string
    explanation: string
  }
  ranking: {
    offers: Array<{
      offer: {
        id: string
        providerName: string
        priceMon: string
        reputation: number
        quality: number
        latencyMs: number
      }
      score: number
    }>
    selected: {
      offer: {
        providerName: string
        priceMon: string
      }
      reason: string
    }
  }
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
        payment: {
          state: "confirmed"
          transactionId: string
        }
        providerVerification: "verified"
        execution: {
          state: "completed"
          result: string
          citations: Array<{ title: string; url: string }>
        }
      }
    | {
        state: "budget-exceeded"
        message: string
      }
  integration: {
    planner: "deterministic" | "llm"
    settlement: "demo" | "monad"
    provider: "demo" | "remote"
  }
  economics: {
    spentMon: string
    servicesPurchased: number
    humanApprovals: number
  }
}

type TaskStreamEvent =
  | { type: "progress"; progress: { message: string; content?: string } }
  | { type: "result"; result: TaskView }
  | { type: "error"; message: string }

const readTaskStream = async (
  response: Response,
  onProgress: (progress: { message: string; content?: string }) => void
) => {
  if (!response.body) throw new Error("The Task stream could not be read.")

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let task: TaskView | null = null

  const handleLine = (line: string) => {
    if (!line) return
    let event: TaskStreamEvent
    try {
      event = JSON.parse(line) as TaskStreamEvent
    } catch {
      throw new Error("The Task stream returned an invalid event.")
    }
    if (event.type === "progress") {
      onProgress(event.progress)
      return
    }
    if (event.type === "error") throw new Error(event.message)
    if (event.type === "result") task = event.result
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) handleLine(line)
      if (done) break
    }
    if (buffer) handleLine(buffer)
  } finally {
    reader.releaseLock()
  }

  if (!task) throw new Error("The Task stream ended without a result.")
  return task
}

export const App = () => {
  const [goal, setGoal] = useState("Research the Monad ecosystem and identify five promising projects.")
  const [budgetMon, setBudgetMon] = useState("0.01")
  const [task, setTask] = useState<TaskView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [progressMessage, setProgressMessage] = useState<string | null>(null)
  const [streamedOutput, setStreamedOutput] = useState("")
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileElement = useRef<HTMLDivElement>(null)
  const turnstileWidgetId = useRef<string | null>(null)

  useEffect(() => {
    const render = () => {
      if (!turnstileElement.current || !window.turnstile || turnstileWidgetId.current) return

      turnstileWidgetId.current = window.turnstile.render(turnstileElement.current, {
        sitekey: turnstileSiteKey,
        action: "task-submit",
        callback: setTurnstileToken,
        "expired-callback": () => setTurnstileToken(null),
        "error-callback": () => setTurnstileToken(null),
      })
    }

    const script = document.querySelector<HTMLScriptElement>(
      'script[src^="https://challenges.cloudflare.com/turnstile/"]'
    )
    if (window.turnstile) render()
    else script?.addEventListener("load", render, { once: true })

    return () => {
      script?.removeEventListener("load", render)
      if (turnstileWidgetId.current) window.turnstile?.remove(turnstileWidgetId.current)
      turnstileWidgetId.current = null
    }
  }, [])

  const runTask = async () => {
    setIsRunning(true)
    setError(null)
    setTask(null)
    setProgressMessage("Starting Task")
    setStreamedOutput("")

    try {
      const response = await fetch("/api/tasks/stream", {
        method: "POST",
        headers: {
          accept: "application/x-ndjson",
          "content-type": "application/json",
          "x-turnstile-token": turnstileToken ?? "",
        },
        body: JSON.stringify({ goal, budgetMon }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string }
        throw new Error(payload.message ?? "The Task could not be created.")
      }

      setTask(
        await readTaskStream(response, (progress) => {
          setProgressMessage(progress.message)
          if (progress.content) setStreamedOutput((output) => `${output}${progress.content}`)
        })
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Task could not be created.")
    } finally {
      if (turnstileWidgetId.current) window.turnstile?.reset(turnstileWidgetId.current)
      setTurnstileToken(null)
      setProgressMessage(null)
      setIsRunning(false)
    }
  }

  return (
    <main>
      <section aria-labelledby="mcpay-title">
        <p>MCPay · autonomous commerce</p>
        <h1 id="mcpay-title">Give an Agent a goal and a Budget.</h1>
        <label>
          Task goal
          <textarea value={goal} onChange={(event) => setGoal(event.target.value)} />
        </label>
        <label>
          Task Budget (MON)
          <input value={budgetMon} onChange={(event) => setBudgetMon(event.target.value)} inputMode="decimal" />
        </label>
        <div ref={turnstileElement} />
        <button type="button" onClick={runTask} disabled={isRunning || !turnstileToken}>
          {isRunning ? "Planning…" : "Run Agent"}
        </button>
      </section>

      {error ? <p role="alert">{error}</p> : null}

      {isRunning && progressMessage ? (
        <section aria-live="polite" aria-label="Live Task output">
          <p>{progressMessage}</p>
          {streamedOutput ? <p>{streamedOutput}</p> : null}
        </section>
      ) : null}

      {task ? (
        <section aria-live="polite" aria-label="Task progress">
          <p>Planning complete</p>
          <h2>{task.plan.label}</h2>
          <p>{task.plan.explanation}</p>
          <h2>{task.ranking.selected.offer.providerName} selected</h2>
          <p>{task.ranking.selected.reason}</p>
          <p>{task.ranking.selected.offer.priceMon} MON</p>
          <h2>Provider comparison</h2>
          <ul aria-label="Provider Offers">
            {task.ranking.offers.map(({ offer }) => (
              <li key={offer.id}>
                <strong>{offer.providerName}</strong> · {offer.priceMon} MON · Reputation {offer.reputation} · Quality{" "}
                {offer.quality} · {offer.latencyMs} ms
              </li>
            ))}
          </ul>
          <p>
            Integrations: {task.integration.planner} planner · {task.integration.settlement} settlement ·{" "}
            {task.integration.provider} Provider
          </p>
          {task.purchase.state === "completed" ? (
            <>
              <h2>HTTP {task.purchase.paymentRequest.protocolStatus} · Payment Required</h2>
              <p>
                {task.purchase.paymentRequest.amountMon} MON on {task.purchase.paymentRequest.network}
              </p>
              <p>Payment confirmed</p>
              <p>Provider verified payment</p>
              <p>Execution complete</p>
              <p>{task.purchase.execution.result}</p>
              <ul aria-label="Research sources">
                {task.purchase.execution.citations.map((citation) => (
                  <li key={citation.url}>
                    <a href={citation.url}>{citation.title}</a>
                  </li>
                ))}
              </ul>
              <p>Transaction: {task.purchase.payment.transactionId}</p>
            </>
          ) : (
            <p role="alert">{task.purchase.message}</p>
          )}
          <h2>Task economics</h2>
          <p>Spent: {task.economics.spentMon} MON</p>
          <p>Services purchased: {task.economics.servicesPurchased}</p>
          <p>Human approvals: {task.economics.humanApprovals}</p>
        </section>
      ) : null}
    </main>
  )
}
