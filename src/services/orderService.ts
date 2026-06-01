import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient'
import type { CartLine } from './cartService'
import type { CheckoutContact, EntrySource, LocationSnapshot, Order } from '../types/order'
import type { SupportedLanguage } from '../types/language'

export type SubmitOrderInput = {
  cart: CartLine[]
  contact: CheckoutContact
  language: SupportedLanguage
  location?: LocationSnapshot
  source: EntrySource
  telegramInitData?: string
}

export type SubmitOrderResult = {
  orderId: string
  status: Order['status']
  total: number
}

export const orderService = {
  /**
   * 通过 submit-order Edge Function 提交前台订单。
   * 业务用途：用户提交购物车、联系方式、地址和来源，服务端必须重新校验商品、价格和 Telegram 身份。
   * 未配置 Supabase 时返回本地预览订单号，便于开发环境完整验证购物车到提交成功的前台流程。
   */
  async submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
    if (!isSupabaseConfigured()) {
      return {
        orderId: `LOCAL-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        status: 'new',
        total: 0,
      }
    }

    const { data, error } = await getSupabaseClient().functions.invoke<SubmitOrderResult>('submit-order', {
      body: input,
    })

    if (error) {
      throw error
    }

    if (!data?.orderId) {
      throw new Error('submit-order Edge Function returned an invalid response.')
    }

    return data
  },

  /**
   * 按订单 ID 读取订单详情。
   * 业务用途：预留给未来订单提交成功页或订单查询页。
   * 当前尚未接入，因为公开读取订单需要单独的访问控制设计。
   */
  async getOrder(orderId: string): Promise<Order | null> {
    void orderId
    return null
  },
}
