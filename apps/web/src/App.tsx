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
  | { type: "progress"; progress: { stage: AgentStage; message: string; content?: string } }
  | { type: "result"; result: TaskView }
  | { type: "error"; message: string }

type AgentStage = "planning" | "offers" | "payment" | "execution"

type AgentProgress = { stage: AgentStage; message: string; content?: string }

const agentStages: Array<{ stage: AgentStage; label: string; detail: string }> = [
  { stage: "planning", label: "Interpret task", detail: "Plan the work and discover offers" },
  { stage: "offers", label: "Select provider", detail: "Compare service quality and price" },
  { stage: "payment", label: "Settle payment", detail: "Submit and confirm the MON transfer" },
  { stage: "execution", label: "Synthesize research", detail: "Verify payment and stream the evidence-based answer" },
]

const readTaskStream = async (response: Response, onProgress: (progress: AgentProgress) => void) => {
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
  const [activeStage, setActiveStage] = useState<AgentStage | null>(null)
  const [stageMessages, setStageMessages] = useState<Partial<Record<AgentStage, string>>>({})
  const [streamedOutput, setStreamedOutput] = useState("")
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileElement = useRef<HTMLDivElement>(null)
  const turnstileWidgetId = useRef<string | null>(null)
  const transcriptElement = useRef<HTMLDivElement>(null)
  const pendingOutput = useRef("")
  const outputFrame = useRef<number | null>(null)

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

  useEffect(() => {
    const transcript = transcriptElement.current
    if (transcript) transcript.scrollTop = transcript.scrollHeight
  }, [streamedOutput])

  useEffect(
    () => () => {
      if (outputFrame.current !== null) window.cancelAnimationFrame(outputFrame.current)
    },
    []
  )

  const flushOutput = () => {
    if (outputFrame.current !== null) {
      window.cancelAnimationFrame(outputFrame.current)
      outputFrame.current = null
    }
    const output = pendingOutput.current
    pendingOutput.current = ""
    if (output) setStreamedOutput((current) => `${current}${output}`)
  }

  const queueOutput = (content: string) => {
    pendingOutput.current += content
    if (outputFrame.current !== null) return
    outputFrame.current = window.requestAnimationFrame(() => {
      outputFrame.current = null
      flushOutput()
    })
  }

  const runTask = async () => {
    setIsRunning(true)
    setError(null)
    setTask(null)
    setProgressMessage("Interpreting your task")
    setActiveStage("planning")
    setStageMessages({ planning: "Interpreting your task" })
    pendingOutput.current = ""
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
          setActiveStage(progress.stage)
          setStageMessages((messages) => ({ ...messages, [progress.stage]: progress.message }))
          if (progress.content) queueOutput(progress.content)
        })
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Task could not be created.")
    } finally {
      flushOutput()
      if (turnstileWidgetId.current) window.turnstile?.reset(turnstileWidgetId.current)
      setTurnstileToken(null)
      setIsRunning(false)
    }
  }

  const activeStageIndex = activeStage ? agentStages.findIndex(({ stage }) => stage === activeStage) : -1
  const stageStatus = (stage: AgentStage, index: number) => {
    if (error && stage === activeStage) return "failed"
    if (index < activeStageIndex || (!isRunning && activeStageIndex >= 0 && index <= activeStageIndex))
      return "complete"
    if (stage === activeStage) return "active"
    return "pending"
  }

  return (
    <main className="mx-auto w-[min(100%-2rem,78rem)] pt-[clamp(2.5rem,7vw,6.5rem)] pb-20 antialiased">
      <header className="mb-8 grid items-end gap-x-16 gap-y-6 [grid-template-columns:minmax(0,1fr)_minmax(12rem,.48fr)] max-[48rem]:grid-cols-1">
        <p className="font-mono text-[.68rem] leading-[1.45] font-bold tracking-[.13em] text-[#aab5ff] uppercase">
          MCPay / Agent commerce
        </p>
        <h1
          id="mcpay-title"
          className="col-start-1 mt-2 max-w-[10ch] text-[clamp(3.3rem,8vw,6.8rem)] leading-[.84] font-semibold tracking-[-.075em] max-[48rem]:col-auto max-[48rem]:max-w-[11ch]"
        >
          A task becomes a trace.
        </h1>
        <p className="col-start-2 text-[.98rem] leading-[1.65] text-[#aeb4c3] max-[48rem]:col-auto">
          Set a goal and a MON budget. MCPay makes the plan, settles the service, and shows its work.
        </p>
      </header>

      <div
        className="grid overflow-hidden rounded-[1.25rem] border border-[#282d3c] bg-[rgba(16,19,28,.78)] shadow-[0_1.5rem_5rem_rgba(0,0,0,.28)] backdrop-blur-[16px] [grid-template-columns:minmax(17rem,.76fr)_minmax(22rem,1.24fr)] max-[48rem]:grid-cols-1 max-[48rem]:rounded-2xl"
        aria-labelledby="mcpay-title"
      >
        <section
          className="grid content-start gap-[1.4rem] border-r border-[#282d3c] bg-white/[.015] p-[clamp(1.5rem,4vw,2.6rem)] max-[48rem]:border-r-0 max-[48rem]:border-b"
          aria-label="Create a Task"
        >
          <div className="grid gap-2">
            <p className="font-mono text-[.68rem] leading-[1.45] font-bold tracking-[.13em] text-[#aab5ff] uppercase">
              New task
            </p>
            <p className="text-[.86rem] leading-[1.55] text-[#858b9d]">
              Payment runs only after the selected service fits your budget.
            </p>
          </div>
          <label className="grid gap-2 text-[.82rem] font-bold text-[#dfe2ed]">
            <span>Task goal</span>
            <textarea
              className="min-h-38 w-full resize-y rounded-[.65rem] border border-[#343a4b] bg-[#0d1018] px-4 py-[.9rem] leading-[1.55] text-[#f2f3f8] transition-colors hover:border-[#515a73] focus:border-[#8c99ff] focus:bg-[#101421] focus:outline-none"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-[.82rem] font-bold text-[#dfe2ed]">
            <span>Task Budget</span>
            <span className="grid min-h-12 grid-cols-[1fr_auto] items-center overflow-hidden rounded-[.65rem] border border-[#343a4b] bg-[#0d1018] transition-colors focus-within:border-[#8c99ff]">
              <input
                className="min-h-[2.85rem] w-full border-0 bg-transparent px-[.9rem] py-[.65rem] text-[#f2f3f8] outline-none"
                aria-label="Task Budget (MON)"
                value={budgetMon}
                onChange={(event) => setBudgetMon(event.target.value)}
                inputMode="decimal"
              />
              <strong className="px-[.9rem] font-mono text-[.75rem] tracking-[.08em] text-[#aeb4c3]">MON</strong>
            </span>
          </label>
          <div className="min-h-[4.1rem]" ref={turnstileElement} />
          <button
            className="min-h-[3.2rem] cursor-pointer rounded-[.65rem] border border-[#b5c0ff] bg-[#bdc5ff] font-extrabold text-[#111321] shadow-[0_.8rem_1.8rem_rgba(125,139,255,.2)] transition-[transform,box-shadow,opacity] hover:not-disabled:-translate-y-px hover:not-disabled:shadow-[0_1rem_2.2rem_rgba(125,139,255,.32)] disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            onClick={runTask}
            disabled={isRunning || !turnstileToken}
          >
            {isRunning ? "Agent is working" : "Run Agent"}
          </button>
        </section>

        <aside
          className="grid min-h-140 grid-rows-[auto_auto_minmax(14rem,1fr)] gap-7 bg-[linear-gradient(135deg,rgba(112,124,255,.055),transparent_38%),#11141d] p-[clamp(1.5rem,4vw,2.6rem)] max-[48rem]:min-h-124"
          aria-label="Agent execution trace"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[.68rem] leading-[1.45] font-bold tracking-[.13em] text-[#aab5ff] uppercase">
                Live execution trace
              </p>
              <h2 className="mt-2 text-[clamp(1.3rem,3vw,1.8rem)] font-semibold tracking-[-.035em]">
                {isRunning ? (progressMessage ?? "Working") : task ? "Task complete" : "Ready"}
              </h2>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2 py-1 font-mono text-[.63rem] font-extrabold tracking-[.11em] ${isRunning ? "border-[rgba(217,177,120,.65)] text-[#efc88d]" : "border-[#343a4b] text-[#858b9d]"}`}
            >
              {isRunning ? "LIVE" : task ? "DONE" : "IDLE"}
            </span>
          </div>

          <ol className="grid list-none gap-[1.15rem] p-0" aria-label="Task stages">
            {agentStages.map(({ stage, label, detail }, index) => {
              const status = stageStatus(stage, index)
              const colors =
                status === "active"
                  ? {
                      text: "text-[#f1f2f8]",
                      detail: "text-[#b9c0d0]",
                      marker:
                        "border-[#efc88d] bg-[#efc88d] shadow-[0_0_0_.35rem_rgba(239,200,141,.12)] [animation:trace-pulse_1.65s_ease-in-out_infinite]",
                      line: "bg-[#6976cb]",
                    }
                  : status === "complete"
                    ? {
                        text: "text-[#c1c8d8]",
                        detail: "text-[#626a7d]",
                        marker: "border-[#9eaaff] bg-[#9eaaff]",
                        line: "bg-[#6976cb]",
                      }
                    : status === "failed"
                      ? {
                          text: "text-[#ffafa9]",
                          detail: "text-[#626a7d]",
                          marker: "border-[#ff8c85] bg-[#ff8c85]",
                          line: "bg-[#343a4b]",
                        }
                      : {
                          text: "text-[#656c7e]",
                          detail: "text-[#626a7d]",
                          marker: "border-[#4d556a] bg-[#11141d]",
                          line: "bg-[#343a4b]",
                        }
              return (
                <li key={stage} className={`relative grid min-h-10 grid-cols-[1rem_1fr] gap-[.85rem] ${colors.text}`}>
                  {index < agentStages.length - 1 ? (
                    <span
                      className={`absolute top-4 bottom-[-1.15rem] left-[.46rem] w-px ${colors.line}`}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span
                    className={`z-1 mt-[.2rem] size-[.9rem] rounded-full border ${colors.marker}`}
                    aria-hidden="true"
                  />
                  <div>
                    <strong className="block text-[.88rem]">{label}</strong>
                    <p className={`mt-1 text-[.77rem] leading-[1.45] ${colors.detail}`}>
                      {stageMessages[stage] ?? detail}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>

          <div
            className="min-h-56 max-h-96 overflow-auto rounded-[.8rem] border border-[#282d3c] bg-[rgba(5,7,11,.42)] px-[1.1rem] py-4 text-[#dfe2ed] [scrollbar-color:#414963_transparent]"
            ref={transcriptElement}
            aria-live="off"
            aria-label="Streaming research output"
          >
            {streamedOutput ? (
              <p className="font-mono text-[.8rem] leading-[1.72] whitespace-pre-wrap">
                {streamedOutput}
                {isRunning ? (
                  <span
                    className="ml-[.12rem] inline-block h-[1em] w-[.55ch] translate-y-[.12em] bg-[#efc88d] [animation:cursor-blink_900ms_steps(1)_infinite]"
                    aria-hidden="true"
                  />
                ) : null}
              </p>
            ) : (
              <p className="font-mono text-[.8rem] leading-[1.72] text-[#697084]">
                {isRunning
                  ? "Research output will appear here as one continuous response."
                  : "The Agent is ready for a verified task."}
              </p>
            )}
          </div>
        </aside>
      </div>

      {error ? (
        <p
          className="mt-5 rounded-[1.1rem] border border-[rgba(230,116,108,.55)] bg-[rgba(16,19,28,.78)] px-5 py-4 text-[#ffbab4]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {task ? (
        <section
          className="mt-5 grid gap-x-12 gap-y-6 rounded-[1.1rem] border border-[#282d3c] bg-[rgba(16,19,28,.78)] p-[clamp(1.5rem,4vw,2.6rem)] [grid-template-columns:minmax(0,1fr)_minmax(16rem,.5fr)] max-[48rem]:grid-cols-1"
          aria-live="polite"
          aria-label="Task result"
        >
          <div>
            <p className="font-mono text-[.68rem] leading-[1.45] font-bold tracking-[.13em] text-[#aab5ff] uppercase">
              Execution record
            </p>
            <h2 className="mt-2 text-[1.2rem] tracking-[-.025em]">{task.plan.label}</h2>
          </div>
          <p className="text-[.86rem] leading-[1.6] text-[#aeb4c3]">{task.plan.explanation}</p>
          <div className="col-start-1 border-t border-[#282d3c] pt-5 max-[48rem]:col-auto">
            <p className="font-mono text-[.68rem] leading-[1.45] font-bold tracking-[.13em] text-[#aab5ff] uppercase">
              Selected provider
            </p>
            <h3 className="mt-2 text-[1.2rem] tracking-[-.025em]">{task.ranking.selected.offer.providerName}</h3>
            <p className="text-[.86rem] leading-[1.6] text-[#aeb4c3]">{task.ranking.selected.reason}</p>
            <strong className="mt-3 block font-mono text-[#efc88d]">{task.ranking.selected.offer.priceMon} MON</strong>
          </div>
          <div className="col-start-2 row-span-2 row-start-1 border-t border-[#282d3c] pt-5 max-[48rem]:col-auto max-[48rem]:row-auto">
            <h3 className="text-[1.2rem] tracking-[-.025em]">Provider comparison</h3>
            <ul
              className="mt-3 grid gap-2 pl-[1.1rem] text-[.86rem] leading-[1.6] text-[#aeb4c3]"
              aria-label="Provider Offers"
            >
              {task.ranking.offers.map(({ offer }) => (
                <li key={offer.id}>
                  <strong>{offer.providerName}</strong> · {offer.priceMon} MON · Reputation {offer.reputation} · Quality{" "}
                  {offer.quality} · {offer.latencyMs} ms
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[.86rem] leading-[1.6] text-[#aeb4c3]">
            Integrations: {task.integration.planner} planner · {task.integration.settlement} settlement ·{" "}
            {task.integration.provider} Provider
          </p>
          {task.purchase.state === "completed" ? (
            <div className="grid gap-2 border-t border-[#282d3c] pt-5">
              <h3 className="text-[1.2rem] tracking-[-.025em]">
                HTTP {task.purchase.paymentRequest.protocolStatus} · Payment Required
              </h3>
              <p className="text-[.86rem] leading-[1.6] text-[#aeb4c3]">
                {task.purchase.paymentRequest.amountMon} MON on {task.purchase.paymentRequest.network}
              </p>
              <p className="text-[.86rem] leading-[1.6] text-[#aeb4c3]">Payment confirmed</p>
              <p className="text-[.86rem] leading-[1.6] text-[#aeb4c3]">Provider verified payment</p>
              <p className="text-[.86rem] leading-[1.6] text-[#aeb4c3]">Execution complete</p>
              <p className="text-[.86rem] leading-[1.6] text-[#aeb4c3]">{task.purchase.execution.result}</p>
              <ul
                className="mt-3 grid gap-2 pl-[1.1rem] text-[.86rem] leading-[1.6] text-[#aeb4c3]"
                aria-label="Research sources"
              >
                {task.purchase.execution.citations.map((citation) => (
                  <li key={citation.url}>
                    <a className="text-[#bdc5ff]" href={citation.url}>
                      {citation.title}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-[.86rem] leading-[1.6] text-[#aeb4c3]">
                Transaction: {task.purchase.payment.transactionId}
              </p>
            </div>
          ) : (
            <p className="text-[.86rem] leading-[1.6] text-[#aeb4c3]" role="alert">
              {task.purchase.message}
            </p>
          )}
          <div className="grid gap-2 border-t border-[#282d3c] pt-5">
            <h3 className="text-[1.2rem] tracking-[-.025em]">Task economics</h3>
            <p className="text-[.86rem] leading-[1.6] text-[#aeb4c3]">Spent: {task.economics.spentMon} MON</p>
            <p className="text-[.86rem] leading-[1.6] text-[#aeb4c3]">
              Services purchased: {task.economics.servicesPurchased}
            </p>
            <p className="text-[.86rem] leading-[1.6] text-[#aeb4c3]">
              Human approvals: {task.economics.humanApprovals}
            </p>
          </div>
        </section>
      ) : null}
    </main>
  )
}
