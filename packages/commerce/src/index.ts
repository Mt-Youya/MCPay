export type Offer = {
  id: string
  providerName: string
  service: string
  priceMon: string
  reputation: number
  quality: number
  latencyMs: number
  recipient: `0x${string}`
  paymentAmountNative: string
}

export type RankedOffer = {
  offer: Offer
  score: number
  reason: string
}

export type OfferRanking = {
  offers: RankedOffer[]
  selected: RankedOffer
}

const monAtomicUnits = (amount: string) => {
  const [whole = "0", fraction = ""] = amount.trim().split(".")
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction)) {
    throw new Error("MON amounts must be non-negative decimal strings")
  }

  return BigInt(whole) * 1_000_000_000_000_000_000n + BigInt(`${fraction}000000000000000000`.slice(0, 18))
}

export const canAfford = (budgetMon: string, priceMon: string) => monAtomicUnits(budgetMon) >= monAtomicUnits(priceMon)

const offerScore = (offer: Offer, highestPrice: number, slowestLatency: number) => {
  const price = Number.parseFloat(offer.priceMon)
  const priceScore = highestPrice === 0 ? 1 : 1 - price / highestPrice
  const latencyScore = slowestLatency === 0 ? 1 : 1 - offer.latencyMs / slowestLatency

  return offer.reputation * 0.5 + offer.quality * 0.3 + priceScore * 100 * 0.15 + latencyScore * 100 * 0.05
}

export const rankOffers = (offers: Offer[]): OfferRanking => {
  if (offers.length === 0) {
    throw new Error("At least one Offer is required")
  }

  const highestPrice = Math.max(...offers.map((offer) => Number.parseFloat(offer.priceMon)))
  const slowestLatency = Math.max(...offers.map((offer) => offer.latencyMs))
  const rankedOffers = offers
    .map((offer) => {
      const score = offerScore(offer, highestPrice, slowestLatency)

      return {
        offer,
        score,
        reason: `${offer.providerName} has the strongest deterministic Offer score.`,
      }
    })
    .toSorted((left, right) => right.score - left.score || left.offer.id.localeCompare(right.offer.id))

  return { offers: rankedOffers, selected: rankedOffers[0] }
}
