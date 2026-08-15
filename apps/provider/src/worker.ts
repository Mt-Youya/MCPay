import { createConfiguredProviderApp } from "./index.js"

export default {
  fetch(request, env) {
    return createConfiguredProviderApp(env).fetch(request)
  },
} satisfies ExportedHandler<Env>
