# MCPay

MCPay is the commerce domain for autonomous AI agents that need to acquire digital capabilities from service providers without requiring a human checkout step.

## Language

**User**:
A human who gives an Agent a goal and authorizes a bounded amount of value for completing it.
_Avoid_: Customer, operator, wallet owner

**Agent**:
An autonomous software actor that pursues a User's goal and may independently acquire paid capabilities while staying within its authorized Budget.
_Avoid_: Bot, assistant, backend worker

**Agent Wallet**:
The value-bearing identity from which an Agent pays Providers.
_Avoid_: User wallet, treasury, payment account

**Task**:
A goal assigned by a User to an Agent with a defined Budget and a completion outcome.
_Avoid_: Prompt, request, job

**Budget**:
The maximum value an Agent is authorized to spend while completing a Task.
_Avoid_: Balance, allowance, credit

**Service**:
A capability that an Agent can acquire and invoke, independent of which Provider supplies it.
_Avoid_: Tool, API, endpoint

**Provider**:
An economic actor that offers one or more Services to Agents in exchange for payment.
_Avoid_: Vendor, MCP server, API owner

**Offer**:
A Provider's purchasable terms for a Service, including its price and selection signals.
_Avoid_: Listing, plan, subscription

**Marketplace**:
The environment in which Agents discover Services and compare competing Offers from Providers.
_Avoid_: App store, catalog

**Reputation**:
A selection signal representing a Provider's historical reliability in completing paid Executions.
_Avoid_: Rating, review score, trust guarantee

**Execution**:
One paid invocation of a Service by an Agent.
_Avoid_: API call, tool call, request

**Payment Request**:
A machine-readable demand for payment returned by a Provider before a paid Execution can proceed.
_Avoid_: Invoice, checkout, subscription

**Payment**:
A transfer of value from an Agent Wallet to a Provider in exchange for authorization to perform an Execution.
_Avoid_: Deposit, charge, purchase order

**Settlement**:
The final recording and transfer of value for a Payment on the shared blockchain network.
_Avoid_: Billing, accounting

**Human Approval**:
An explicit User confirmation required after a Task has already started and before a specific purchase can proceed.
_Avoid_: Authorization, budget

**Autonomous Purchase**:
A Service acquisition initiated and completed by an Agent within its Budget without Human Approval.
_Avoid_: Auto-pay, background payment
