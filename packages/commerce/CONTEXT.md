# Commerce Context

Commerce owns small, deterministic domain contracts shared by the API and Provider.

## Responsibilities

- Define an `Offer`: service, Provider identity, MON display amount, native atomic amount, settlement recipient and selection signals.
- Compare decimal MON amounts using integer atomic units instead of floating point.
- Rank Offers reproducibly by reputation, quality, price and latency.

## Invariants

- `priceMon` is a decimal display value; `paymentAmountNative` is the authoritative 18-decimal MON settlement amount.
- Ranking must be deterministic for the same set of Offers.
- An empty Offer list is an error, not a selection result.

This package does not call a network, own state, handle wallets or make LLM decisions.
