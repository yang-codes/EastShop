import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

type EntrySource = 'web' | 'telegram' | 'instagram'
type OrderStatus = 'new' | 'contacted' | 'fulfilled' | 'cancelled'

type CancelOrderInput = {
  orderId?: string
  phone?: string
}

type NotificationSettingsRow = {
  feishu_enabled: boolean
  feishu_secret: string | null
  feishu_webhook: string | null
}

type OrderItemRow = {
  product_name: string
  quantity: number
  subtotal: number
  variant_name: string | null
}

type OrderRow = {
  id: string
  address: string | null
  customer_name: string | null
  note: string | null
  phone: string
  social_handle: string | null
  social_platform: string | null
  source: EntrySource
  status: OrderStatus
  total: number
  order_items?: OrderItemRow[]
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const encoder = new TextEncoder()

class ResponseError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  })
}

function normalizePhone(value: string) {
  return value.replace(/[\s()-]/g, '').trim()
}

function formatUnknownError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

async function hmacSha256Base64(keyText: string, text: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(keyText), { hash: 'SHA-256', name: 'HMAC' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(text))

  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

function getSourceLabel(source: EntrySource) {
  if (source === 'telegram') {
    return 'Telegram 小程序'
  }

  if (source === 'instagram') {
    return 'Instagram'
  }

  return 'Web'
}

async function sendFeishuCancelNotification(settings: NotificationSettingsRow, order: OrderRow) {
  if (!settings.feishu_enabled) {
    console.log('Feishu cancel notification skipped: disabled')
    return
  }

  if (!settings.feishu_webhook?.trim()) {
    console.log('Feishu cancel notification skipped: webhook missing')
    return
  }

  const itemLines = (order.order_items ?? []).map((item) => {
    const variant = item.variant_name ? ` / ${item.variant_name}` : ''
    return `- ${item.product_name}${variant} x ${item.quantity} = $${Number(item.subtotal ?? 0).toFixed(2)}`
  })

  const contentLines = [
    `订单取消：${order.id}`,
    `来源：${getSourceLabel(order.source)}`,
    `金额：$${Number(order.total ?? 0).toFixed(2)}`,
    order.customer_name?.trim() ? `客户：${order.customer_name}` : '',
    `手机号：${order.phone}`,
    order.social_handle?.trim()
      ? `社交账号：${order.social_platform ? `${order.social_platform} ` : ''}${order.social_handle}`
      : '',
    order.address?.trim() ? `地址：${order.address}` : '',
    order.note?.trim() ? `备注：${order.note}` : '',
    itemLines.length > 0 ? `\n商品：\n${itemLines.join('\n')}` : '',
  ].filter(Boolean)

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const payload: Record<string, unknown> = {
    msg_type: 'text',
    content: {
      text: contentLines.join('\n'),
    },
  }

  const feishuSecret = settings.feishu_secret?.trim()
  if (feishuSecret) {
    payload.timestamp = timestamp
    payload.sign = await hmacSha256Base64(`${timestamp}\n${feishuSecret}`, '')
  }

  const response = await fetch(settings.feishu_webhook, {
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`Feishu webhook failed with HTTP ${response.status}`)
  }

  const result = (await response.json().catch(() => null)) as { code?: number; msg?: string } | null
  if (result && typeof result.code === 'number' && result.code !== 0) {
    throw new Error(`Feishu webhook failed: ${result.code} ${result.msg ?? ''}`.trim())
  }

  console.log(`Feishu cancel notification sent: order=${order.id}`)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported.' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new ResponseError('SERVER_CONFIG_MISSING', 'Supabase server configuration is missing.', 500)
    }

    const input = (await request.json()) as CancelOrderInput
    const orderId = input.orderId?.trim()
    const phone = normalizePhone(input.phone ?? '')

    if (!orderId || !phone) {
      throw new ResponseError('INVALID_INPUT', 'Order ID and mobile phone are required.', 400)
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    })

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        `
          id,
          address,
          customer_name,
          note,
          phone,
          social_handle,
          social_platform,
          source,
          status,
          total,
          order_items (
            product_name,
            quantity,
            subtotal,
            variant_name
          )
        `,
      )
      .eq('id', orderId)
      .eq('phone', phone)
      .maybeSingle()

    if (orderError) {
      console.error('cancel-order select failed:', orderError)
      throw new ResponseError('ORDER_LOOKUP_FAILED', 'Order lookup failed.', 500)
    }

    if (!order) {
      throw new ResponseError('ORDER_NOT_FOUND', 'Order not found.', 404)
    }

    const orderRow = order as OrderRow
    if (orderRow.status !== 'new') {
      throw new ResponseError('ORDER_NOT_CANCELLABLE', 'Only new orders can be cancelled.', 409)
    }

    const { data: updated, error: updateError } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId)
      .eq('phone', phone)
      .eq('status', 'new')
      .select('id, status')
      .maybeSingle()

    if (updateError) {
      console.error('cancel-order update failed:', updateError)
      throw new ResponseError('ORDER_CANCEL_FAILED', 'Order cancellation failed.', 500)
    }

    if (!updated) {
      throw new ResponseError('ORDER_NOT_CANCELLABLE', 'Only new orders can be cancelled.', 409)
    }

    const cancelledOrder: OrderRow = {
      ...orderRow,
      status: 'cancelled',
    }

    try {
      const { data: settings, error: settingsError } = await supabase
        .from('notification_settings')
        .select('feishu_enabled, feishu_webhook, feishu_secret')
        .eq('id', 'default')
        .maybeSingle()

      if (settingsError) {
        throw settingsError
      }

      if (settings) {
        await sendFeishuCancelNotification(settings as NotificationSettingsRow, cancelledOrder)
      }
    } catch (notificationError) {
      console.error('Feishu cancel notification failed:', notificationError)
    }

    return jsonResponse({ orderId: updated.id, status: updated.status })
  } catch (error) {
    if (error instanceof ResponseError) {
      return jsonResponse({ error: error.code, message: error.message }, error.status)
    }

    console.error('cancel-order unexpected error:', error)
    return jsonResponse({ error: 'UNKNOWN_ERROR', message: formatUnknownError(error) }, 500)
  }
})
