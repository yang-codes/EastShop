import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type EntrySource = 'telegram' | 'instagram' | 'web'
type SupportedLanguage = 'zh' | 'en' | 'ru' | 'uz'

type CartLine = {
  productId: string
  quantity: number
  variantId?: string
}

type CheckoutContact = {
  address: string
  name: string
  note?: string
  phone: string
  socialPlatform?: string
  socialHandle?: string
}

type LocationSnapshot = {
  accuracy?: number
  city?: string
  country?: string
  latitude?: number
  longitude?: number
  street?: string
}

type SubmitOrderInput = {
  cart?: CartLine[]
  contact?: CheckoutContact
  companyWebsite?: string
  language?: SupportedLanguage
  location?: LocationSnapshot
  source?: EntrySource
  telegramInitData?: string
}

type ProductRow = {
  cover_image: string | null
  id: string
  is_active: boolean
  name_en: string
  name_ru: string
  name_uz: string
  name_zh: string
  specs: unknown
  variants?: unknown
}

type NotificationSettingsRow = {
  feishu_enabled: boolean
  feishu_secret: string | null
  feishu_webhook: string | null
}

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

type OrderDuplicateCandidate = {
  cart_fingerprint?: string | null
  id: string
  total?: number | string | null
  order_items?: Array<{
    product_id: string
    quantity: number
    variant_id?: string | null
  }>
}

const requestRateLimitBuckets = new Map<string, { count: number; resetAt: number }>()
const phoneRateLimitBuckets = new Map<string, { count: number; resetAt: number }>()
const notificationThrottleBuckets = new Map<string, number>()
const REQUEST_RATE_LIMIT_WINDOW_MS = 60_000
const REQUEST_RATE_LIMIT_MAX = 10
const PHONE_RATE_LIMIT_WINDOW_MS = 10 * 60_000
const PHONE_RATE_LIMIT_MAX = 3
const DUPLICATE_ORDER_WINDOW_MS = 5 * 60_000
const FEISHU_NOTIFICATION_THROTTLE_MS = 60_000

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  })
}

function formatUnknownError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    const messageParts = [record.message, record.details, record.hint, record.code ? `(${record.code})` : ''].filter(Boolean)

    if (messageParts.length > 0) {
      return messageParts.join(' ')
    }

    try {
      return JSON.stringify(record)
    } catch {
      return 'Unknown object error.'
    }
  }

  return 'Failed to submit order.'
}

function assertContact(contact: SubmitOrderInput['contact']) {
  if (!contact?.phone?.trim()) {
    throw new ResponseError('INVALID_CONTACT', 'Mobile phone is required.', 400)
  }
}

function normalizePhone(value: string) {
  return value.trim().replace(/[^\d+]/g, '')
}

function getClientKey(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || request.headers.get('cf-connecting-ip')?.trim()
    || 'unknown'
}

function assertRateLimit(bucketMap: Map<string, { count: number; resetAt: number }>, key: string, windowMs: number, maxRequests: number) {
  const now = Date.now()
  const bucket = bucketMap.get(key)

  if (!bucket || bucket.resetAt <= now) {
    bucketMap.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  if (bucket.count >= maxRequests) {
    throw new ResponseError('RATE_LIMITED', 'Too many requests. Try again later.', 429)
  }

  bucket.count += 1
}

function assertHoneypot(input: SubmitOrderInput) {
  if (typeof input.companyWebsite === 'string' && input.companyWebsite.trim()) {
    throw new ResponseError('INVALID_REQUEST', 'Invalid request.', 400)
  }
}

function normalizeCart(cart: SubmitOrderInput['cart']) {
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new ResponseError('EMPTY_CART', 'Cart is empty.', 400)
  }

  const quantities = new Map<string, CartLine>()

  for (const line of cart) {
    const productId = line.productId?.trim()
    const quantity = Number(line.quantity)
    const variantId = typeof line.variantId === 'string' ? line.variantId.trim() : undefined

    if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
      throw new ResponseError('INVALID_CART_LINE', 'Every cart line must include a productId and a positive quantity.', 400)
    }

    const key = `${productId}::${variantId ?? ''}`
    const currentLine = quantities.get(key)
    quantities.set(key, {
      productId,
      quantity: (currentLine?.quantity ?? 0) + quantity,
      variantId,
    })
  }

  return [...quantities.values()]
}

function getCartFingerprint(lines: Array<Pick<CartLine, 'productId' | 'quantity' | 'variantId'>>) {
  return lines
    .map((line) => `${line.productId}::${line.variantId ?? ''}::${line.quantity}`)
    .sort()
    .join('|')
}

function getBeijingTimestampFromUnixMs(value: number) {
  return new Date(value + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)
}

function isSameMoneyValue(candidate: number | string | null | undefined, expected: number) {
  const candidateNumber = Number(candidate)

  return Number.isFinite(candidateNumber) && candidateNumber.toFixed(2) === expected.toFixed(2)
}

function isDuplicateOrderDatabaseError(error: unknown) {
  const message = formatUnknownError(error)

  return message.includes('DUPLICATE_ORDER')
}

function getLocalizedName(product: ProductRow, language: SupportedLanguage) {
  if (language === 'zh') {
    return product.name_zh || product.name_en || product.name_ru || product.name_uz || product.id
  }

  if (language === 'ru') {
    return product.name_ru || product.name_en || product.name_zh || product.name_uz || product.id
  }

  if (language === 'uz') {
    return product.name_uz || product.name_zh || product.name_en || product.name_ru || product.id
  }

  return product.name_en || product.name_zh || product.name_ru || product.name_uz || product.id
}

function getLocalizedVariantName(variant: { name?: Record<string, string> }, language: SupportedLanguage) {
  return variant.name?.[language] || variant.name?.zh || variant.name?.en || variant.name?.ru || variant.name?.uz || ''
}

function getProductVariants(product: ProductRow) {
  return Array.isArray(product.variants)
    ? product.variants as Array<{ id?: string; isActive?: boolean; name?: Record<string, string>; price?: number | string }>
    : []
}

class ResponseError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

type TelegramVerificationResult = {
  authDate: number
  user: Record<string, unknown> | null
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

function normalizeSocialPlatform(value: unknown) {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
  return normalized || null
}

function getSocialContactLine(contact: CheckoutContact) {
  const handle = contact.socialHandle?.trim()
  if (!handle) {
    return ''
  }

  const platform = normalizeSocialPlatform(contact.socialPlatform)
  return `社交账号：${platform ? `${platform} ` : ''}${handle}`
}

async function assertNotDuplicateOrder(
  supabase: ReturnType<typeof createClient>,
  phone: string,
  source: EntrySource,
  total: number,
  cartFingerprint: string,
) {
  const duplicateSince = getBeijingTimestampFromUnixMs(Date.now() - DUPLICATE_ORDER_WINDOW_MS)
  const { data, error } = await supabase
    .from('orders')
    .select('id, total, cart_fingerprint, order_items(product_id, variant_id, quantity)')
    .eq('phone', phone)
    .eq('source', source)
    .gte('created_at', duplicateSince)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    throw new ResponseError('DUPLICATE_CHECK_FAILED', formatUnknownError(error), 500)
  }

  const duplicate = ((data ?? []) as OrderDuplicateCandidate[]).find((order) => {
    if (!isSameMoneyValue(order.total, total)) {
      return false
    }

    if (order.cart_fingerprint) {
      return order.cart_fingerprint === cartFingerprint
    }

    return getCartFingerprint((order.order_items ?? []).map((item) => ({
      productId: item.product_id,
      quantity: Number(item.quantity),
      variantId: item.variant_id ?? undefined,
    }))) === cartFingerprint
  })

  if (duplicate) {
    throw new ResponseError('DUPLICATE_ORDER', 'A matching order was submitted recently. Please wait before submitting again.', 409)
  }
}

function shouldThrottleFeishuNotification(key: string) {
  const now = Date.now()
  const lastSentAt = notificationThrottleBuckets.get(key) ?? 0

  if (now - lastSentAt < FEISHU_NOTIFICATION_THROTTLE_MS) {
    return true
  }

  notificationThrottleBuckets.set(key, now)
  return false
}

async function sendFeishuNotification(settings: NotificationSettingsRow, order: { id: string; source: EntrySource; total: number }, contact: CheckoutContact, items: Array<{ productName: string; quantity: number; subtotal: number; variant_name?: string | null }>) {
  if (!settings.feishu_enabled) {
    console.log('Feishu notification skipped: disabled')
    return
  }

  if (!settings.feishu_webhook) {
    console.log('Feishu notification skipped: webhook missing')
    return
  }

  if (shouldThrottleFeishuNotification(`${contact.phone}:${order.source}`)) {
    console.log(`Feishu notification skipped: throttled order=${order.id}`)
    return
  }

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const contentLines = [
    `新订单：${order.id}`,
    `来源：${getSourceLabel(order.source)}`,
    `金额：$${order.total.toFixed(2)}`,
    contact.name?.trim() ? `客户：${contact.name}` : '',
    `手机号：${contact.phone}`,
    getSocialContactLine(contact),
    contact.address?.trim() ? `地址：${contact.address}` : '',
    contact.note?.trim() ? `备注：${contact.note}` : '',
    '',
    '商品：',
    ...items.map((item) => `- ${item.productName}${item.variant_name ? ` / ${item.variant_name}` : ''} x ${item.quantity} = $${item.subtotal.toFixed(2)}`),
  ].filter(Boolean)

  const payload: Record<string, unknown> = {
    content: {
      text: contentLines.join('\n'),
    },
    msg_type: 'text',
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

  const result = await response.json().catch(() => null) as { code?: number; msg?: string } | null

  if (result && typeof result.code === 'number' && result.code !== 0) {
    throw new Error(`Feishu webhook failed: ${result.code} ${result.msg ?? ''}`.trim())
  }

  console.log(`Feishu notification sent: order=${order.id}`)
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
      throw new ResponseError('MISSING_SERVER_CONFIG', 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.', 500)
    }

    assertRateLimit(
      requestRateLimitBuckets,
      `submit-order:${getClientKey(request)}`,
      REQUEST_RATE_LIMIT_WINDOW_MS,
      REQUEST_RATE_LIMIT_MAX,
    )

    const input = (await request.json()) as SubmitOrderInput
    assertHoneypot(input)

    const language = input.language === 'zh' || input.language === 'ru' || input.language === 'uz' ? input.language : 'en'
    const source = input.source === 'telegram' || input.source === 'instagram' || input.source === 'web' ? input.source : 'web'
    let telegramUser: Record<string, unknown> | null = null
    let telegramAuthDate: number | null = null
    let telegramUserId: string | null = null

    assertContact(input.contact)
    const normalizedPhone = normalizePhone(input.contact?.phone ?? '')

    if (!normalizedPhone) {
      throw new ResponseError('INVALID_CONTACT', 'Mobile phone is required.', 400)
    }

    assertRateLimit(
      phoneRateLimitBuckets,
      `submit-order-phone:${normalizedPhone}`,
      PHONE_RATE_LIMIT_WINDOW_MS,
      PHONE_RATE_LIMIT_MAX,
    )

    if (source === 'telegram') {
      if (!input.telegramInitData) {
        throw new ResponseError('INVALID_TELEGRAM_INIT_DATA', 'Telegram initData is required for Telegram orders.', 401)
      }

      const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
      if (!telegramBotToken) {
        throw new ResponseError('MISSING_TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_TOKEN is not configured.', 500)
      }

      const configuredMaxAge = Number(Deno.env.get('TELEGRAM_INIT_DATA_MAX_AGE_SECONDS') ?? '86400')
      const maxAgeSeconds = Number.isFinite(configuredMaxAge) ? configuredMaxAge : 86400
      const verification = await verifyTelegramInitData(input.telegramInitData, telegramBotToken, maxAgeSeconds)
      telegramUser = verification.user
      telegramAuthDate = verification.authDate
      telegramUserId = getTelegramUserId(telegramUser)

      if (!telegramUserId) {
        throw new ResponseError('INVALID_TELEGRAM_INIT_DATA', 'Telegram initData user id is missing.', 401)
      }
    }

    const cart = normalizeCart(input.cart)
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    })

    const productIds = cart.map((line) => line.productId)
    const { data: products, error: productsError } = await supabase.from('products').select('id, name_zh, name_en, name_ru, name_uz, cover_image, specs, variants, is_active').in('id', productIds)

    if (productsError) {
      throw new ResponseError('PRODUCTS_QUERY_FAILED', formatUnknownError(productsError), 500)
    }

    const productById = new Map((products as ProductRow[] | null ?? []).map((product) => [product.id, product]))

    const items = cart.map((line) => {
      const product = productById.get(line.productId)

      if (!product) {
        throw new ResponseError('PRODUCT_NOT_FOUND', `Product ${line.productId} was not found.`, 400)
      }

      if (!product.is_active) {
        throw new ResponseError('PRODUCT_INACTIVE', `Product ${line.productId} is not active.`, 400)
      }

      const variants = getProductVariants(product).filter((variant) => variant.id && variant.isActive !== false)
      const selectedVariant = line.variantId
        ? variants.find((variant) => variant.id === line.variantId)
        : variants.find((variant) => variant.isDefault) ?? variants[0]

      if (line.variantId && !selectedVariant) {
        throw new ResponseError('PRODUCT_VARIANT_NOT_FOUND', `Variant ${line.variantId} was not found or inactive.`, 400)
      }

      if (!selectedVariant) {
        throw new ResponseError('PRODUCT_VARIANT_REQUIRED', `Product ${product.id} has no active purchasable variants.`, 400)
      }

      const unitPrice = Number(selectedVariant.price)
      const subtotal = Number((unitPrice * line.quantity).toFixed(2))

      return {
        image: product.cover_image,
        language,
        price: unitPrice,
        product_id: product.id,
        productName: getLocalizedName(product, language),
        quantity: line.quantity,
        specs: Array.isArray(product.specs) ? product.specs : [],
        subtotal,
        variant_id: selectedVariant?.id ?? null,
        variant_name: selectedVariant ? getLocalizedVariantName(selectedVariant, language) : null,
      }
    })

    const total = Number(items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2))
    const contact = { ...(input.contact as CheckoutContact), phone: normalizedPhone }
    const location = input.location
    const cartFingerprint = getCartFingerprint(cart)

    await assertNotDuplicateOrder(supabase, normalizedPhone, source, total, cartFingerprint)

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        address: contact.address?.trim() ?? '',
        cart_fingerprint: cartFingerprint,
        customer_name: contact.name?.trim() ?? '',
        geo_city: location?.city ?? null,
        geo_country: location?.country ?? null,
        geo_street: location?.street ?? null,
        language,
        latitude: location?.latitude ?? null,
        location_accuracy: location?.accuracy ?? null,
        longitude: location?.longitude ?? null,
        note: contact.note?.trim() || null,
        phone: normalizedPhone,
        social_handle: contact.socialHandle?.trim() || null,
        social_platform: normalizeSocialPlatform(contact.socialPlatform),
        source,
        status: 'new',
        telegram_user: source === 'telegram' ? { authDate: telegramAuthDate, initDataVerified: true, user: telegramUser } : null,
        telegram_user_id: source === 'telegram' ? telegramUserId : null,
        total,
      })
      .select('id, status, total')
      .single()

    if (orderError) {
      if (isDuplicateOrderDatabaseError(orderError)) {
        throw new ResponseError('DUPLICATE_ORDER', 'A matching order was submitted recently. Please wait before submitting again.', 409)
      }

      throw new ResponseError('ORDER_INSERT_FAILED', formatUnknownError(orderError), 500)
    }

    const orderId = order.id as string
    const { error: itemError } = await supabase.from('order_items').insert(
      items.map((item) => ({
        image: item.image,
        language: item.language,
        order_id: orderId,
        price: item.price,
        product_id: item.product_id,
        product_name: item.productName,
        quantity: item.quantity,
        specs: item.specs,
        subtotal: item.subtotal,
        variant_id: item.variant_id,
        variant_name: item.variant_name,
      })),
    )

    if (itemError) {
      await supabase.from('orders').delete().eq('id', orderId)
      throw new ResponseError('ORDER_ITEMS_INSERT_FAILED', formatUnknownError(itemError), 500)
    }

    try {
      const { data: settings, error: notificationSettingsError } = await supabase
        .from('notification_settings')
        .select('feishu_enabled, feishu_webhook, feishu_secret')
        .eq('id', 'default')
        .maybeSingle()

      if (notificationSettingsError) {
        throw notificationSettingsError
      }

      if (settings) {
        console.log(
          `Feishu notification settings loaded: enabled=${String(settings.feishu_enabled)} webhook=${settings.feishu_webhook ? 'present' : 'missing'} secret=${settings.feishu_secret ? 'present' : 'missing'}`,
        )
        await sendFeishuNotification(settings as NotificationSettingsRow, { id: orderId, source, total }, contact, items)
      } else {
        console.warn('Feishu notification skipped: notification_settings row not found')
      }
    } catch (notificationError) {
      console.error('Feishu notification failed:', notificationError)
    }

    return jsonResponse({
      orderId,
      status: order.status,
      total,
    })
  } catch (error) {
    if (error instanceof ResponseError) {
      return jsonResponse({ code: error.code, error: error.code, message: error.message }, error.status)
    }

    console.error('submit-order failed:', error)

    return jsonResponse(
      {
        code: 'SUBMIT_ORDER_FAILED',
        error: 'SUBMIT_ORDER_FAILED',
        message: formatUnknownError(error),
      },
      500,
    )
  }
})
