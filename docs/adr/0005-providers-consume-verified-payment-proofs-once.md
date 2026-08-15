# Providers consume verified Payment Proofs once

Each Provider will issue a Payment Request before a paid Execution, then verify the Agent's Monad Payment Proof against the requested recipient and amount. The Provider records the verified Payment Proof in durable storage before authorizing one Execution, so a valid Payment cannot be replayed for additional Service use; the Cloudflare implementation uses D1 and an atomic unique transaction-hash insert.
