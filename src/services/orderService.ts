import { getSupabaseConfig, isSupabaseConfigured } from '../lib/supabaseClient'
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

export type LookupOrdersInput = {
  phone: string
  orderId?: string
  socialHandle?: string
}

export type CancelOrderInput = {
  orderId: string
  phone: string
}

export type CancelOrderResult = {
  orderId: string
  status: Order['status']
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

    const { anonKey, url } = getSupabaseConfig()
    const response = await fetch(`${url}/functions/v1/submit-order`, {
      body: JSON.stringify(input),
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
      },
      method: 'POST',
    })

    const responseText = await response.text()
    let data: (SubmitOrderResult & { code?: string; details?: string; error?: string; hint?: string; message?: string }) | null = null

    try {
      data = responseText ? JSON.parse(responseText) : null
    } catch {
      data = null
    }

    if (!response.ok) {
      const serverMessage = [data?.message, data?.details, data?.hint, data?.code ? `(${data.code})` : ''].filter(Boolean).join(' ')

      throw new Error(serverMessage || responseText || `submit-order Edge Function returned HTTP ${response.status}.`)
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

  /**
   * 用手机号 + 订单号或手机号 + 社交账号查询前台订单。
   * 业务用途：客户自助查看自己的订单状态，后台改状态后这里实时读取最新数据。
   */
  async lookupOrders(input: LookupOrdersInput): Promise<Order[]> {
    if (!isSupabaseConfigured()) {
      return []
    }

    const { anonKey, url } = getSupabaseConfig()
    let response: Response

    try {
      response = await fetch(`${url}/functions/v1/lookup-orders`, {
        body: JSON.stringify(input),
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
        },
        method: 'POST',
      })
    } catch (error) {
      throw new Error(
        error instanceof TypeError
          ? '订单查询服务暂不可用，请确认 lookup-orders Edge Function 已部署并关闭 JWT 校验。'
          : 'Order lookup failed.',
      )
    }

    const responseText = await response.text()
    let data: { orders?: Order[]; message?: string } | null = null

    try {
      data = responseText ? JSON.parse(responseText) : null
    } catch {
      data = null
    }

    if (!response.ok) {
      throw new Error(data?.message ?? 'Order lookup failed.')
    }

    return data?.orders ?? []
  },

  /**
   * 取消客户自己的新订单。
   * 业务用途：客户在“我的订单”中只能取消仍处于新订单状态的订单；服务端会再次校验手机号和订单状态。
   */
  async cancelOrder(input: CancelOrderInput): Promise<CancelOrderResult> {
    if (!isSupabaseConfigured()) {
      return {
        orderId: input.orderId,
        status: 'cancelled',
      }
    }

    const { anonKey, url } = getSupabaseConfig()
    let response: Response

    try {
      response = await fetch(`${url}/functions/v1/cancel-order`, {
        body: JSON.stringify(input),
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
        },
        method: 'POST',
      })
    } catch (error) {
      throw new Error(
        error instanceof TypeError
          ? '取消订单服务暂不可用，请确认 cancel-order Edge Function 已部署并关闭 JWT 校验。'
          : 'Order cancellation failed.',
      )
    }

    const responseText = await response.text()
    let data: (CancelOrderResult & { message?: string }) | null = null

    try {
      data = responseText ? JSON.parse(responseText) : null
    } catch {
      data = null
    }

    if (!response.ok) {
      throw new Error(data?.message ?? 'Order cancellation failed.')
    }

    if (!data?.orderId || data.status !== 'cancelled') {
      throw new Error('cancel-order Edge Function returned an invalid response.')
    }

    return data
  },
}
