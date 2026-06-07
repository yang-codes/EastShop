const baseCorsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 30

type SupportedLanguage = 'zh' | 'en' | 'ru' | 'uz'

type ReverseGeocodeInput = {
  accuracy?: number
  language?: SupportedLanguage
  latitude?: number
  longitude?: number
}

type GeoapifyFeature = {
  properties?: {
    city?: string
    country?: string
    county?: string
    district?: string
    formatted?: string
    municipality?: string
    state?: string
    street?: string
    suburb?: string
    town?: string
    village?: string
  }
}

type GeoapifyReverseResponse = {
  features?: GeoapifyFeature[]
}

class ResponseError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

function getAllowedOrigins() {
  return (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function getCorsHeaders(request: Request) {
  const origin = request.headers.get('Origin') ?? ''
  const allowedOrigins = getAllowedOrigins()
  const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
  const isAllowedOrigin = !origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin) || isLocalOrigin

  return {
    ...baseCorsHeaders,
    'Access-Control-Allow-Origin': isAllowedOrigin && origin ? origin : allowedOrigins.length === 0 ? '*' : allowedOrigins[0] ?? '',
  }
}

function assertAllowedOrigin(request: Request) {
  const origin = request.headers.get('Origin') ?? ''
  const allowedOrigins = getAllowedOrigins()
  const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)

  if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin) && !isLocalOrigin) {
    throw new ResponseError('ORIGIN_NOT_ALLOWED', 'Origin is not allowed.', 403)
  }
}

function getClientKey(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || request.headers.get('cf-connecting-ip')?.trim()
    || 'unknown'
}

function assertRateLimit(key: string) {
  const now = Date.now()
  const bucket = rateLimitBuckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return
  }

  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    throw new ResponseError('RATE_LIMITED', 'Too many requests. Try again later.', 429)
  }

  bucket.count += 1
}

function jsonResponse(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...getCorsHeaders(request),
      'Content-Type': 'application/json',
    },
    status,
  })
}

function getFallbackSnapshot(input: Required<Pick<ReverseGeocodeInput, 'latitude' | 'longitude'>> & Pick<ReverseGeocodeInput, 'accuracy'>) {
  return {
    accuracy: input.accuracy,
    formattedAddress: `${input.latitude.toFixed(6)}, ${input.longitude.toFixed(6)}`,
    latitude: input.latitude,
    longitude: input.longitude,
  }
}

function normalizeLanguage(language: ReverseGeocodeInput['language']) {
  return language === 'en' || language === 'ru' || language === 'zh' || language === 'uz' ? language : 'zh'
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) })
  }

  try {
    assertAllowedOrigin(request)
    assertRateLimit(`reverse-geocode:${getClientKey(request)}`)

    if (request.method !== 'POST') {
      throw new ResponseError('METHOD_NOT_ALLOWED', 'Only POST is supported.', 405)
    }

    const input = (await request.json()) as ReverseGeocodeInput
    const latitude = Number(input.latitude)
    const longitude = Number(input.longitude)

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new ResponseError('INVALID_COORDINATES', 'Latitude and longitude are required.', 400)
    }

    const fallback = getFallbackSnapshot({
      accuracy: Number.isFinite(Number(input.accuracy)) ? Number(input.accuracy) : undefined,
      latitude,
      longitude,
    })
    const apiKey = Deno.env.get('GEOAPIFY_API_KEY')

    if (!apiKey) {
      return jsonResponse(request, { location: fallback })
    }

    const params = new URLSearchParams({
      apiKey,
      lang: normalizeLanguage(input.language),
      lat: String(latitude),
      lon: String(longitude),
    })
    const response = await fetch(`https://api.geoapify.com/v1/geocode/reverse?${params.toString()}`)

    if (!response.ok) {
      console.error('reverse-geocode Geoapify failed:', response.status, await response.text())
      return jsonResponse(request, { location: fallback })
    }

    const data = (await response.json()) as GeoapifyReverseResponse
    const properties = data.features?.[0]?.properties

    if (!properties) {
      return jsonResponse(request, { location: fallback })
    }

    const city = properties.city || properties.town || properties.village || properties.municipality || properties.county || properties.state
    const district = properties.district || properties.suburb || properties.county

    return jsonResponse(request, {
      location: {
        ...fallback,
        city,
        country: properties.country,
        district,
        formattedAddress: properties.formatted || fallback.formattedAddress,
        street: properties.street,
      },
    })
  } catch (error) {
    if (error instanceof ResponseError) {
      return jsonResponse(request, { error: error.code, message: error.message }, error.status)
    }

    console.error('reverse-geocode unexpected error:', error)
    return jsonResponse(request, { error: 'UNKNOWN_ERROR', message: 'Unexpected server error.' }, 500)
  }
})
