import { describe, expect, it } from "vitest"

import { rankOffers, type Offer } from "./index.js"

const offers: Offer[] = [
  {
    id: "search-cheap",
    providerName: "SearchCheap",
    service: "web-research",
    priceUsd: "0.0005",
    reputation: 82,
    quality: 80,
    latencyMs: 200,
    recipient: "0x1111111111111111111111111111111111111111",
    paymentAmountNative: "1000000000000000",
  },
  {
    id: "search-pro",
    providerName: "SearchPro",
    service: "web-research",
    priceUsd: "0.0010",
    reputation: 97,
    quality: 95,
    latencyMs: 180,
    recipient: "0x2222222222222222222222222222222222222222",
    paymentAmountNative: "1000000000000000",
  },
]

describe("rankOffers", () => {
  it("selects the highest-scoring Offer with a stable explanation", () => {
    const ranking = rankOffers(offers)

    expect(ranking.selected.offer.id).toBe("search-pro")
    expect(ranking.selected.reason).toContain("SearchPro")
    expect(ranking.offers.map(({ offer }) => offer.id)).toEqual(["search-pro", "search-cheap"])
  })
})
