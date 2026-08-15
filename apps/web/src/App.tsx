import { useState } from "react"

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
        priceUsd: string
        reputation: number
        quality: number
        latencyMs: number
      }
      score: number
    }>
    selected: {
      offer: {
        providerName: string
        priceUsd: string
      }
      reason: string
    }
  }
  purchase:
    | {
        state: "completed"
        paymentRequest: {
          protocolStatus: number
          amountUsd: string
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
    spentUsd: string
    servicesPurchased: number
    humanApprovals: number
  }
}

export const App = () => {
  const [goal, setGoal] = useState("Research the Monad ecosystem and identify five promising projects.")
  const [budgetUsd, setBudgetUsd] = useState("0.10")
  const [task, setTask] = useState<TaskView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const runTask = async () => {
    setIsRunning(true)
    setError(null)
    setTask(null)

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ goal, budgetUsd }),
      })
      const payload = (await response.json()) as TaskView & { message?: string }

      if (!response.ok) {
        throw new Error(payload.message ?? "The Task could not be created.")
      }

      setTask(payload)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Task could not be created.")
    } finally {
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
          Task Budget
          <input value={budgetUsd} onChange={(event) => setBudgetUsd(event.target.value)} inputMode="decimal" />
        </label>
        <button type="button" onClick={runTask} disabled={isRunning}>
          {isRunning ? "Planning…" : "Run Agent"}
        </button>
      </section>

      {error ? <p role="alert">{error}</p> : null}

      {task ? (
        <section aria-live="polite" aria-label="Task progress">
          <p>Planning complete</p>
          <h2>{task.plan.label}</h2>
          <p>{task.plan.explanation}</p>
          <h2>{task.ranking.selected.offer.providerName} selected</h2>
          <p>{task.ranking.selected.reason}</p>
          <p>${task.ranking.selected.offer.priceUsd}</p>
          <h2>Provider comparison</h2>
          <ul aria-label="Provider Offers">
            {task.ranking.offers.map(({ offer }) => (
              <li key={offer.id}>
                <strong>{offer.providerName}</strong> · ${offer.priceUsd} · Reputation {offer.reputation} · Quality{" "}
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
                ${task.purchase.paymentRequest.amountUsd} on {task.purchase.paymentRequest.network}
              </p>
              <p>Payment confirmed</p>
              <p>Provider verified payment</p>
              <p>Execution complete</p>
              <p>{task.purchase.execution.result}</p>
              <p>Transaction: {task.purchase.payment.transactionId}</p>
            </>
          ) : (
            <p role="alert">{task.purchase.message}</p>
          )}
          <h2>Task economics</h2>
          <p>Spent: ${task.economics.spentUsd}</p>
          <p>Services purchased: {task.economics.servicesPurchased}</p>
          <p>Human approvals: {task.economics.humanApprovals}</p>
        </section>
      ) : null}
    </main>
  )
}
