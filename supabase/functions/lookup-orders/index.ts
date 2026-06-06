import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type OrderStatus = 'new' | 'contacted' | 'fulfilled' | 'cancelled'
type EntrySource = 'telegram' | 'instagram' | 'web'

type LookupOrdersInput = {
  phone?: string
  orderId?: string
  socialHandle?: string
  socialPlatform?: string
  telegramInitData?: string
}

type TelegramVerificationResult = {
  authDate: number
  user: Record<string, unknown> | null
}

class ResponseError extends Error {
  status: number
  code: string

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function normalizePhone(value: string) {
  return value.trim().replace(/[^\d+]/g, '')
}

function normalizeSocial(value: string) {
  return value.trim()
}

const encoder = new TextEncoder()

async function hmacSha256(keyData: string | Uint8Array, text: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    typeof keyData === 'string' ? encoder.encode(keyData) : keyData,
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(text))

  return new Uint8Array(signature)
}

function toHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false
  }

  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return diff === 0
}

function parseTelegramUser(rawUser: string | null) {
  if (!rawUser) {
    return null
  }

  try {
    const parsed = JSON.parse(rawUser) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

async function verifyTelegramInitData(initData: string, botToken: string, maxAgeSeconds: number): Promise<TelegramVerificationResult> {
  const params = new URLSearchParams(initData)
  const receivedHash = params.get('hash')
  const authDateRaw = params.get('auth_date')
  const authDate = authDateRaw ? Number(authDateRaw) : Number.NaN

  if (!receivedHash) {
    throw new ResponseError('INVALID_TELEGRAM_INIT_DATA', 'Telegram initData hash is missing.', 401)
  }

  if (!Number.isFinite(authDate)) {
    throw new ResponseError('INVALID_TELEGRAM_INIT_DATA', 'Telegram initData auth_date is missing or invalid.', 401)
  }

  if (maxAgeSeconds > 0) {
    const ageSeconds = Math.floor(Date.now() / 1000) - authDate
    if (ageSeconds < 0 || ageSeconds > maxAgeSeconds) {
      throw new ResponseError('INVALID_TELEGRAM_INIT_DATA', 'Telegram initData has expired.', 401)
    }
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = await hmacSha256('WebAppData', botToken)
  const expectedHash = toHex(await hmacSha256(secretKey, dataCheckString))

  if (!timingSafeEqual(expectedHash, receivedHash)) {
    throw new ResponseError('INVALID_TELEGRAM_INIT_DATA', 'Telegram initData verification failed.', 401)
  }

  return {
    authDate,
    user: parseTelegramUser(params.get('user')),
  }
}

function getTelegramUserId(user: Record<string, unknown> | null) {
  const rawId = user?.id

  if (typeof rawId === 'number' && Number.isFinite(rawId)) {
    return String(Math.trunc(rawId))
  }

  if (typeof rawId === 'string') {
    return rawId.trim()
  }

  return ''
}

function mapOrder(row: any) {
  return {
    id: row.id,
    source: (row.source ?? 'web') as EntrySource,
    status: (row.status ?? 'new') as OrderStatus,
    contact: {
      name: row.customer_name ?? '',
      phone: row.phone ?? '',
      address: row.address ?? '',
      note: row.note ?? '',
      socialHandle: row.social_handle ?? '',
      socialPlatform: row.social_platform ?? '',
    },
    location: {
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined,
      accuracy: row.location_accuracy ?? undefined,
      country: row.geo_country ?? undefined,
      city: row.geo_city ?? undefined,
      street: row.geo_street ?? undefined,
      formattedAddress: row.address ?? undefined,
    },
    items: (row.order_items ?? []).map((item: any) => ({
      productId: item.product_id,
      productName: item.product_name,
      language: item.language ?? 'zh',
      variantId: item.variant_id ?? undefined,
      variantName: item.variant_name ?? undefined,
      unitPrice: Number(item.price ?? 0),
      quantity: Number(item.quantity ?? 0),
      subtotal: Number(item.subtotal ?? 0),
    })),
    total: Number(row.total ?? 0),
    createdAt: row.created_at,
  }
}

const orderSelect = `
  id,
  source,
  status,
  customer_name,
  phone,
  address,
  note,
  social_handle,
  social_platform,
  total,
  created_at,
  latitude,
  longitude,
  location_accuracy,
  geo_country,
  geo_city,
  geo_street,
  order_items (
    product_id,
    product_name,
    language,
    price,
    quantity,
    subtotal,
    variant_id,
    variant_name
  )
`

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (request.method !== 'POST') {
      throw new ResponseError('METHOD_NOT_ALLOWED', 'Only POST is supported.', 405)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new ResponseError('SERVER_CONFIG_MISSING', 'Supabase server configuration is missing.', 500)
    }

    const input = (await request.json()) as LookupOrdersInput
    const telegramInitData = input.telegramInitData?.trim() ?? ''
    const phone = normalizePhone(input.phone ?? '')
    const orderId = input.orderId?.trim()
    const socialHandle = normalizeSocial(input.socialHandle ?? '')

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    })

    if (telegramInitData) {
      const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN')

      if (!telegramBotToken) {
        throw new ResponseError('MISSING_TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_TOKEN is not configured.', 500)
      }

      const configuredMaxAge = Number(Deno.env.get('TELEGRAM_INIT_DATA_MAX_AGE_SECONDS') ?? '86400')
      const maxAgeSeconds = Number.isFinite(configuredMaxAge) ? configuredMaxAge : 86400
      const verification = await verifyTelegramInitData(telegramInitData, telegramBotToken, maxAgeSeconds)
      const telegramUserId = getTelegramUserId(verification.user)

      if (!telegramUserId) {
        throw new ResponseError('INVALID_TELEGRAM_INIT_DATA', 'Telegram initData user id is missing.', 401)
      }

      const { data, error } = await supabase
        .from('orders')
        .select(orderSelect)
        .eq('source', 'telegram')
        .eq('telegram_user_id', telegramUserId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('lookup-orders telegram failed:', error)
        throw new ResponseError('LOOKUP_FAILED', 'Order lookup failed.', 500)
      }

      return jsonResponse({ orders: (data ?? []).map(mapOrder) })
    }

    if (!phone) {
      throw new ResponseError('PHONE_REQUIRED', 'Mobile phone is required.', 400)
    }

    if (!orderId && !socialHandle) {
      throw new ResponseError('LOOKUP_KEY_REQUIRED', 'Order ID or social account is required.', 400)
    }

    let query = supabase
      .from('orders')
      .select(orderSelect)
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(20)

    if (orderId) {
      query = query.eq('id', orderId)
    } else {
      query = query.ilike('social_handle', socialHandle)
    }

    const { data, error } = await query

    if (error) {
      console.error('lookup-orders failed:', error)
      throw new ResponseError('LOOKUP_FAILED', 'Order lookup failed.', 500)
    }

    return jsonResponse({ orders: (data ?? []).map(mapOrder) })
  } catch (error) {
    if (error instanceof ResponseError) {
      return jsonResponse({ error: error.code, message: error.message }, error.status)
    }

    console.error('lookup-orders unexpected error:', error)
    return jsonResponse({ error: 'UNKNOWN_ERROR', message: 'Unexpected server error.' }, 500)
  }
})
