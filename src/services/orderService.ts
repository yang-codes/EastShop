import type { CheckoutContact, EntrySource, LocationSnapshot, Order } from '../types/order'

export type SubmitOrderInput = {
  contact: CheckoutContact
  location?: LocationSnapshot
  source: EntrySource
  telegramInitData?: string
}

export const orderService = {
  async submitOrder(input: SubmitOrderInput) {
    void input
    throw new Error('submit-order Edge Function is not connected yet.')
  },

  async getOrder(orderId: string): Promise<Order | null> {
    void orderId
    return null
  },
}
