import { buildApp } from './app'
import { env } from './config/env'

async function main() {
  const app = buildApp()

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
    app.log.info(`HTTP server listening on port ${env.PORT}`)
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

void main()
