import { Prisma, Order } from '@prisma/client'
import { prisma } from '../db/prisma'

export type CreateOrderInput = {
  orderId: string
  customer: string
  total: number
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  try {
    return await prisma.order.create({
      data: {
        orderId: input.orderId,
        customer: input.customer,
        total: input.total,
        status: 'PENDING',
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      Array.isArray(error.meta?.target) &&
      (error.meta.target as string[]).includes('orderId')
    ) {
      const existing = await prisma.order.findUnique({ where: { orderId: input.orderId } })
      if (existing) return existing
    }
    throw error
  }
}

export function findOrderByOrderId(orderId: string) {
  return prisma.order.findUnique({ where: { orderId } })
}

export function fetchPendingOrders(limit: number, maxAttempts: number) {
  return prisma.order.findMany({
    where: {
      status: 'PENDING',
      lockedAt: null,
      attempts: { lt: maxAttempts },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
}

export async function lockOrderById(id: string): Promise<boolean> {
  const locked = await prisma.order.updateMany({
    where: { id, lockedAt: null, status: 'PENDING' },
    data: { lockedAt: new Date() },
  })

  return locked.count > 0
}

export function markOrderProcessed(id: string) {
  return prisma.order.update({
    where: { id },
    data: {
      status: 'PROCESSED',
      lockedAt: null,
      lastError: null,
    },
  })
}

export function markOrderFailed(id: string, message: string) {
  return prisma.order.update({
    where: { id },
    data: {
      attempts: { increment: 1 },
      lastError: message,
      lockedAt: null,
    },
  })
}
