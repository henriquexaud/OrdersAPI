import pino from 'pino'
import { env } from '../config/env'
import { prisma } from '../db/prisma'
import {
  fetchPendingOrders,
  lockOrderById,
  markOrderFailed,
  markOrderProcessed,
} from '../services/orderService'

const logger = pino({ name: 'worker', level: env.NODE_ENV === 'production' ? 'info' : 'debug' })

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function processOrder(orderId: string, attempts: number, orderRef: string) {
  try {
    logger.info({ orderId: orderRef }, 'Processing order')
    await sleep(env.WORKER_PROCESSING_DELAY_MS)
    await markOrderProcessed(orderId)
    logger.info({ orderId: orderRef }, 'Order processed')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await markOrderFailed(orderId, message)
    const nextAttempt = attempts + 1
    const givingUp = nextAttempt >= env.WORKER_MAX_ATTEMPTS
    logger.error({ orderId: orderRef, attempts: nextAttempt, err: error }, givingUp ? 'Max attempts reached' : 'Processing failed, will retry')
  }
}

async function workLoop() {
  logger.info('Worker started')

  while (true) {
    try {
      const pendingOrders = await fetchPendingOrders(env.WORKER_BATCH_SIZE, env.WORKER_MAX_ATTEMPTS)

      for (const order of pendingOrders) {
        const locked = await lockOrderById(order.id)
        if (!locked) continue

        await processOrder(order.id, order.attempts, order.orderId)
      }
    } catch (error) {
      logger.error({ err: error }, 'Worker loop failure, will retry')
    }

    await sleep(env.WORKER_POLL_INTERVAL_MS)
  }
}

workLoop().catch((err) => {
  logger.error({ err }, 'Worker crashed')
  process.exit(1)
})

const shutdown = async (signal: NodeJS.Signals) => {
  logger.info({ signal }, 'Shutting down worker')
  await prisma.$disconnect().catch(() => logger.warn('Failed to disconnect Prisma cleanly'))
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
