import { serve } from "@hono/node-server"
import "dotenv/config"

import { createConfiguredTaskRunner } from "./runtime.js"
import { createApp } from "./index.js"

serve({ fetch: createApp(createConfiguredTaskRunner()).fetch, port: 8787 })
