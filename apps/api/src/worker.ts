import { createApp } from "./index.js"
import { createConfiguredTaskRunner } from "./runtime.js"
import { createConfiguredApiSecurity } from "./security.js"

export default {
  fetch(request, env) {
    return createApp(
      createConfiguredTaskRunner(env),
      createConfiguredApiSecurity(env, async (clientIp) => ({
        allowed: (await env.MCPAY_TASK_RATE_LIMITER.limit({ key: clientIp })).success,
        retryAfterSeconds: 60,
      }))
    ).fetch(request)
  },
} satisfies ExportedHandler<Env>
