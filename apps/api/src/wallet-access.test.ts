import { privateKeyToAccount } from "viem/accounts"
import { describe, expect, it } from "vitest"

import { createWalletAccess, type WalletAccessDatabase } from "./wallet-access.js"

type Usage = { taskCount: number; spentMilliMon: number }

const createMemoryDatabase = (): WalletAccessDatabase => {
  const nonces = new Map<string, { address: string; expiresAt: string }>()
  const sessions = new Map<string, { address: string; expiresAt: string }>()
  const usage = new Map<string, Usage>()
  const usageKey = (address: string, day: string) => `${address}:${day}`

  return {
    prepare(query) {
      return {
        bind(...values: unknown[]) {
          return {
            async run() {
              if (query.startsWith("INSERT INTO wallet_login_nonces")) {
                nonces.set(String(values[0]), { address: String(values[1]), expiresAt: String(values[2]) })
                return { meta: { changes: 1 } }
              }
              if (query.startsWith("DELETE FROM wallet_login_nonces")) {
                const nonce = nonces.get(String(values[0]))
                if (!nonce || nonce.address !== values[1] || nonce.expiresAt <= String(values[2]))
                  return { meta: { changes: 0 } }
                nonces.delete(String(values[0]))
                return { meta: { changes: 1 } }
              }
              if (query.startsWith("INSERT INTO wallet_sessions")) {
                sessions.set(String(values[0]), { address: String(values[1]), expiresAt: String(values[2]) })
                return { meta: { changes: 1 } }
              }
              if (query.startsWith("DELETE FROM wallet_sessions")) {
                return { meta: { changes: sessions.delete(String(values[0])) ? 1 : 0 } }
              }
              if (query.startsWith("INSERT INTO wallet_daily_usage")) {
                const key = usageKey(String(values[0]), String(values[1]))
                const current = usage.get(key)
                if (current) {
                  if (current.taskCount >= Number(values[2])) return { meta: { changes: 0 } }
                  current.taskCount += 1
                } else usage.set(key, { taskCount: 1, spentMilliMon: 0 })
                return { meta: { changes: 1 } }
              }
              if (query.startsWith("UPDATE wallet_daily_usage")) {
                const key = usageKey(String(values[1]), String(values[2]))
                const current = usage.get(key)
                if (!current || current.spentMilliMon + Number(values[3]) > Number(values[4]))
                  return { meta: { changes: 0 } }
                current.spentMilliMon += Number(values[0])
                return { meta: { changes: 1 } }
              }
              throw new Error(`Unexpected query: ${query}`)
            },
            async first<Row>() {
              if (query.startsWith("SELECT expires_at FROM wallet_login_nonces")) {
                const nonce = nonces.get(String(values[0]))
                return (nonce && nonce.address === values[1] ? { expires_at: nonce.expiresAt } : null) as Row | null
              }
              if (query.startsWith("SELECT wallet_address FROM wallet_sessions")) {
                const session = sessions.get(String(values[0]))
                return (
                  session && session.expiresAt > String(values[1]) ? { wallet_address: session.address } : null
                ) as Row | null
              }
              if (query.startsWith("SELECT task_count")) {
                const current = usage.get(usageKey(String(values[0]), String(values[1])))
                return (
                  current ? { task_count: current.taskCount, spent_milli_mon: current.spentMilliMon } : null
                ) as Row | null
              }
              throw new Error(`Unexpected query: ${query}`)
            },
          }
        },
      }
    },
  }
}

describe("wallet access", () => {
  it("accepts one MetaMask-compatible signature and creates an expiring session", async () => {
    const account = privateKeyToAccount("0x0123456789012345678901234567890123456789012345678901234567890123")
    const access = createWalletAccess({ database: createMemoryDatabase() })
    const challenge = await access.createChallenge({ address: account.address, hostname: "mcpay.yonjay.me" })
    expect(challenge).not.toBeNull()
    if (!challenge) return

    const created = await access.createSession({
      address: account.address,
      nonce: challenge.nonce,
      signature: await account.signMessage({ message: challenge.message }),
      hostname: "mcpay.yonjay.me",
    })

    expect(created?.session.walletAddress).toBe(account.address.toLowerCase())
    await expect(access.session(created?.token)).resolves.toEqual({ walletAddress: account.address.toLowerCase() })
    await expect(
      access.createSession({
        address: account.address,
        nonce: challenge.nonce,
        signature: await account.signMessage({ message: challenge.message }),
        hostname: "mcpay.yonjay.me",
      })
    ).resolves.toBeNull()
  })

  it("caps daily task starts and exact MON spending per wallet", async () => {
    const access = createWalletAccess({ database: createMemoryDatabase(), maxDailyTasks: 2, maxDailyMilliMon: 10 })
    const address = "0x1111111111111111111111111111111111111111" as const

    await expect(access.claimTask(address)).resolves.toBe(true)
    await expect(access.reserveSpend(address, "0.008")).resolves.toBe(true)
    await expect(access.claimTask(address)).resolves.toBe(true)
    await expect(access.reserveSpend(address, "0.003")).resolves.toBe(false)
    await expect(access.claimTask(address)).resolves.toBe(false)
    await expect(access.quotaFor(address)).resolves.toEqual({ dailyTasksRemaining: 0, dailySpendRemainingMon: "0.002" })
  })
})
