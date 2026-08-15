import { serve } from "@hono/node-server"
import "dotenv/config"

import { createConfiguredTaskRunner } from "./runtime.js"
import { createApp } from "./index.js"
import { createConfiguredApiSecurity } from "./security.js"

serve({
  fetch: createApp(createConfiguredTaskRunner(), createConfiguredApiSecurity()).fetch,
  port: 8787,
})
