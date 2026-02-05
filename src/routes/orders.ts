import { FastifyInstance } from 'fastify'
import { Order } from '@prisma/client'
import { z } from 'zod'
import { createOrder, findOrderByOrderId } from '../services/orderService'

const createOrderBodySchema = z.object({
  orderId: z.string().min(1),
  customer: z.string().min(1),
  total: z.coerce.number().positive(),
})

const orderParamsSchema = z.object({
  orderId: z.string().min(1),
})

const orderResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    orderId: { type: 'string' },
    customer: { type: 'string' },
    total: { type: 'number' },
    status: { type: 'string', enum: ['PENDING', 'PROCESSED'] },
    attempts: { type: 'number' },
    lockedAt: { type: ['string', 'null'], format: 'date-time' },
    lastError: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
}

const errorResponseSchema = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    issues: { type: 'object', nullable: true },
  },
}

const serializeOrder = (order: Order) => ({
  ...order,
  total: Number(order.total),
})

export async function ordersRoutes(app: FastifyInstance) {
  app.post('/orders', {
    schema: {
      summary: 'Create order (idempotent)',
      tags: ['orders'],
      description: 'Creates or returns an order by orderId. Duplicate orderId returns the existing row (idempotent).',
      body: {
        type: 'object',
        required: ['orderId', 'customer', 'total'],
        properties: {
          orderId: { type: 'string' },
          customer: { type: 'string' },
          total: { type: 'number' },
        },
      },
      response: {
        200: orderResponseSchema,
        201: orderResponseSchema,
        400: errorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const parsed = createOrderBodySchema.safeParse(request.body)
      if (!parsed.success) {
        reply.status(400).send({ message: 'Invalid request body', issues: parsed.error.format() })
        return
      }

      const order = await createOrder(parsed.data)
      const statusCode = order.status === 'PENDING' ? 201 : 200

      reply.status(statusCode).send(serializeOrder(order))
    },
  })

  app.get('/orders/:orderId', {
    schema: {
      summary: 'Get order by orderId',
      tags: ['orders'],
      description: 'Fetches an order by its business identifier.',
      params: {
        type: 'object',
        required: ['orderId'],
        properties: { orderId: { type: 'string' } },
      },
      response: {
        200: orderResponseSchema,
        400: errorResponseSchema,
        404: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
      },
    },
    handler: async (request, reply) => {
      const parsed = orderParamsSchema.safeParse(request.params)
      if (!parsed.success) {
        reply.status(400).send({ message: 'Invalid params', issues: parsed.error.format() })
        return
      }

      const order = await findOrderByOrderId(parsed.data.orderId)
      if (!order) {
        reply.status(404).send({ message: 'Order not found' })
        return
      }

      reply.send(serializeOrder(order))
    },
  })
}

export default ordersRoutes
