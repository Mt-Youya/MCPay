import { cloudflareTest } from "@cloudflare/vitest-pool-workers"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          MCPAY_PROVIDER_RECEIVING_ADDRESS: "0x1111111111111111111111111111111111111111",
          MCPAY_PROVIDER_DEEPSEEK_API_KEY: "test-deepseek-key",
          MCPAY_PROVIDER_TAVILY_API_KEY: "test-tavily-key",
        },
      },
    }),
  ],
  test: {
    exclude: ["dist/**", "node_modules/**"],
  },
})
