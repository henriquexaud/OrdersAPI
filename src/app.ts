import Fastify from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import ordersRoutes from './routes/orders'
import { env } from './config/env'
import { prisma } from './db/prisma'

export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  })

  app.register(swagger, {
    openapi: {
      info: {
        title: 'Orders API',
        version: '1.0.0',
      },
    },
  })

  app.register(swaggerUi, {
    routePrefix: '/docs',
  })

  app.get('/health', async () => ({ status: 'ok' }))
  app.register(ordersRoutes)

  app.addHook('onClose', async () => {
    await prisma.$disconnect()
  })

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'Unhandled error')

    const statusCode = (() => {
      const code = (error as { statusCode?: number }).statusCode
      if (typeof code === 'number' && code >= 400) return code
      return 500
    })()

    const message = statusCode >= 500 ? 'Internal Server Error' : (error instanceof Error ? error.message : 'Unknown error')

    reply.status(statusCode).send({ message })
  })

  return app
}

export type AppInstance = ReturnType<typeof buildApp>
