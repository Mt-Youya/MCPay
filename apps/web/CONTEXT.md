# Web Context

Web owns the browser surface where a User grants a Task goal and MON Budget, passes Turnstile verification, and observes the resulting commercial execution.

## Responsibilities

- Render the Task form and submit to `POST /api/tasks/stream`.
- Read SSE without assuming every network chunk maps to one user-visible sentence.
- Present the four execution stages: `planning`、`offers`、`payment`、`execution`。
- Present the final economics, payment status, research result and citations.
- Keep the private Agent Wallet and all Provider/LLM credentials out of the browser.

## Non-responsibilities

- Ranking Offers, selecting a Provider or checking Budget.
- Creating or verifying Monad payments.
- Trusting a browser-only payment confirmation.

The API is authoritative for commerce state; the Web UI is an observable projection of that state.
