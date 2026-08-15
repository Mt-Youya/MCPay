# Provider

The Provider context delivers paid research Services to Agents and authorizes each Execution after it consumes a verified Payment Proof.

Cloudflare D1 owns durable Payment Consumption records. Worker-local files are never used for this state.

## Language

**Research Evidence**:
A current web result retrieved by a Provider before an Execution and supplied as source material for the research result.
_Avoid_: Search snippet, model memory, citation

**Evidence Citation**:
The title and URL a Provider returns to a User to identify the Research Evidence used for an Execution.
_Avoid_: Source note, footnote, provenance metadata

**Reference Price**:
A non-authoritative fiat display for an Offer whose Settlement Amount is the value that constrains Payment.
_Avoid_: Budget, Settlement Amount, charge
