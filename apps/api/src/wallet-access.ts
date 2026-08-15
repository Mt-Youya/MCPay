import { verifyMessage } from "viem"

export type WalletAddress = `0x${string}`

export type WalletSession = { walletAddress: WalletAddress }

export type WalletChallenge = { walletAddress: WalletAddress; nonce: string; message: string; expiresAt: string }

export type WalletQuota = {
  dailyTasksRemaining: number
  dailySpendRemainingMon: string
}

type D1Statement = {
  run: () => Promise<{ meta: { changes: number } }>
  first: <Row>() => Promise<Row | null>
}

export type WalletAccessDatabase = {
  prepare: (query: string) => { bind: (...values: unknown[]) => D1Statement }
}

type WalletAccessConfig = {
  database: WalletAccessDatabase
  maxDailyTasks?: number
  maxDailyMilliMon?: number
  sessionTtlMs?: number
  nonceTtlMs?: number
}

type DailyUsage = { task_count: number; spent_milli_mon: number }

const defaultMaxDailyTasks = 10
const defaultMaxDailyMilliMon = 100
const defaultSessionTtlMs = 7 * 24 * 60 * 60 * 1000
const defaultNonceTtlMs = 5 * 60 * 1000

const walletAddress = (value: unknown): WalletAddress | null => {
  if (typeof value !== "string" || !/^0x[\da-fA-F]{40}$/.test(value)) return null
  return value.toLowerCase() as WalletAddress
}

const milliMon = (amountMon: string): number | null => {
  if (!/^\d+(?:\.\d+)?$/.test(amountMon)) return null
  const [whole, fraction = ""] = amountMon.split(".")
  if (fraction.slice(3).replaceAll("0", "") !== "") return null
  const amount = Number(whole) * 1_000 + Number(fraction.slice(0, 3).padEnd(3, "0"))
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null
}

const formatMilliMon = (amount: number) => (amount / 1_000).toFixed(3)

const usageDay = () => new Date().toISOString().slice(0, 10)

const sessionToken = () => crypto.randomUUID().replaceAll("-", "")

const loginMessage = (hostname: string, address: WalletAddress, nonce: string, expiresAt: string) =>
  ["MCPay wallet login", `Domain: ${hostname}`, `Address: ${address}`, `Nonce: ${nonce}`, `Expires: ${expiresAt}`].join(
    "\n"
  )

export const createWalletAccess = ({
  database,
  maxDailyTasks = defaultMaxDailyTasks,
  maxDailyMilliMon = defaultMaxDailyMilliMon,
  sessionTtlMs = defaultSessionTtlMs,
  nonceTtlMs = defaultNonceTtlMs,
}: WalletAccessConfig) => {
  const quotaFor = async (address: WalletAddress): Promise<WalletQuota> => {
    const usage = await database
      .prepare("SELECT task_count, spent_milli_mon FROM wallet_daily_usage WHERE wallet_address = ? AND usage_day = ?")
      .bind(address, usageDay())
      .first<DailyUsage>()
    return {
      dailyTasksRemaining: Math.max(0, maxDailyTasks - Number(usage?.task_count ?? 0)),
      dailySpendRemainingMon: formatMilliMon(Math.max(0, maxDailyMilliMon - Number(usage?.spent_milli_mon ?? 0))),
    }
  }

  return {
    async createChallenge(input: { address: unknown; hostname: string }): Promise<WalletChallenge | null> {
      const address = walletAddress(input.address)
      if (!address || !input.hostname) return null
      const nonce = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + nonceTtlMs).toISOString()
      await database
        .prepare("INSERT INTO wallet_login_nonces (nonce, wallet_address, expires_at) VALUES (?, ?, ?)")
        .bind(nonce, address, expiresAt)
        .run()
      return {
        walletAddress: address,
        nonce,
        expiresAt,
        message: loginMessage(input.hostname, address, nonce, expiresAt),
      }
    },

    async createSession(input: {
      address: unknown
      nonce: unknown
      signature: unknown
      hostname: string
    }): Promise<{ token: string; session: WalletSession; expiresAt: string } | null> {
      const address = walletAddress(input.address)
      if (
        !address ||
        typeof input.nonce !== "string" ||
        !/^[\da-f-]{36}$/i.test(input.nonce) ||
        typeof input.signature !== "string" ||
        !/^0x[\da-fA-F]{130}$/.test(input.signature)
      ) {
        return null
      }
      const challenge = await database
        .prepare("SELECT expires_at FROM wallet_login_nonces WHERE nonce = ? AND wallet_address = ?")
        .bind(input.nonce, address)
        .first<{ expires_at: string }>()
      if (!challenge || Date.parse(challenge.expires_at) <= Date.now()) return null
      const validSignature = await verifyMessage({
        address,
        message: loginMessage(input.hostname, address, input.nonce, challenge.expires_at),
        signature: input.signature as `0x${string}`,
      })
      if (!validSignature) return null
      const consumed = await database
        .prepare("DELETE FROM wallet_login_nonces WHERE nonce = ? AND wallet_address = ? AND expires_at > ?")
        .bind(input.nonce, address, new Date().toISOString())
        .run()
      if (consumed.meta.changes !== 1) return null

      const token = sessionToken()
      const expiresAt = new Date(Date.now() + sessionTtlMs).toISOString()
      await database
        .prepare("INSERT INTO wallet_sessions (token, wallet_address, expires_at) VALUES (?, ?, ?)")
        .bind(token, address, expiresAt)
        .run()
      return { token, session: { walletAddress: address }, expiresAt }
    },

    async session(token: string | undefined): Promise<WalletSession | null> {
      if (!token || !/^[\da-f]{32}$/i.test(token)) return null
      const row = await database
        .prepare("SELECT wallet_address FROM wallet_sessions WHERE token = ? AND expires_at > ?")
        .bind(token, new Date().toISOString())
        .first<{ wallet_address: string }>()
      const address = walletAddress(row?.wallet_address)
      return address ? { walletAddress: address } : null
    },

    async deleteSession(token: string | undefined) {
      if (!token) return
      await database.prepare("DELETE FROM wallet_sessions WHERE token = ?").bind(token).run()
    },

    async claimTask(address: WalletAddress) {
      const result = await database
        .prepare(
          "INSERT INTO wallet_daily_usage (wallet_address, usage_day, task_count, spent_milli_mon) VALUES (?, ?, 1, 0) ON CONFLICT(wallet_address, usage_day) DO UPDATE SET task_count = task_count + 1 WHERE task_count < ?"
        )
        .bind(address, usageDay(), maxDailyTasks)
        .run()
      return result.meta.changes === 1
    },

    async reserveSpend(address: WalletAddress, amountMon: string) {
      const amount = milliMon(amountMon)
      if (amount === null) return false
      const result = await database
        .prepare(
          "UPDATE wallet_daily_usage SET spent_milli_mon = spent_milli_mon + ? WHERE wallet_address = ? AND usage_day = ? AND spent_milli_mon + ? <= ?"
        )
        .bind(amount, address, usageDay(), amount, maxDailyMilliMon)
        .run()
      return result.meta.changes === 1
    },

    quotaFor,
  }
}

export type WalletAccess = ReturnType<typeof createWalletAccess>
