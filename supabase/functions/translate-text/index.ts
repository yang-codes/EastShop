import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

type TranslateRequest = {
  text?: string
}

type TargetLanguage = 'en' | 'ru' | 'uz'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
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

function formatUnknownError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown error'
  }
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function assertAdmin(request: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization') ?? ''
  const token = authorization.replace(/^Bearer\s+/i, '').trim()

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase server config is missing.')
  }

  if (!token) {
    return false
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { data: userData, error: userError } = await supabase.auth.getUser(token)

  if (userError || !userData.user) {
    return false
  }

  const { data: profile, error: profileError } = await supabase
    .from('admin_profiles')
    .select('id')
    .eq('user_id', userData.user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (profileError) {
    throw profileError
  }

  return Boolean(profile)
}

function percentEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
}

function bytesToBase64(bytes: ArrayBuffer | Uint8Array) {
  const byteArray = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''

  for (const byte of byteArray) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

async function hmacSha1Base64(key: string, value: string) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { hash: 'SHA-1', name: 'HMAC' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value))
  return bytesToBase64(signature)
}

function createTimestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function createNonce() {
  return crypto.randomUUID()
}

async function signAliyunQuery(parameters: Record<string, string>, accessKeySecret: string) {
  const canonicalizedQuery = Object.entries(parameters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
    .join('&')
  const stringToSign = `GET&%2F&${percentEncode(canonicalizedQuery)}`

  return hmacSha1Base64(`${accessKeySecret}&`, stringToSign)
}

function isAliyunRetryableError(error: unknown) {
  const message = formatUnknownError(error)
  return /Throttling|ServiceUnavailable|InternalError|HTTP 429|HTTP 5\d\d/i.test(message)
}

async function translateWithAliyun(text: string, targetLanguage: TargetLanguage) {
  const accessKeyId = Deno.env.get('ALIYUN_ACCESS_KEY_ID')
  const accessKeySecret = Deno.env.get('ALIYUN_ACCESS_KEY_SECRET')
  const region = Deno.env.get('ALIYUN_TRANSLATE_REGION') ?? 'cn-hangzhou'
  const endpoint = Deno.env.get('ALIYUN_TRANSLATE_ENDPOINT') ?? `https://mt.${region}.aliyuncs.com`

  if (!accessKeyId || !accessKeySecret) {
    throw new Error('ALIYUN_ACCESS_KEY_ID or ALIYUN_ACCESS_KEY_SECRET is not configured.')
  }

  const parameters: Record<string, string> = {
    AccessKeyId: accessKeyId,
    Action: 'TranslateGeneral',
    Format: 'JSON',
    FormatType: 'text',
    RegionId: region,
    Scene: 'general',
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: createNonce(),
    SignatureVersion: '1.0',
    SourceLanguage: 'zh',
    SourceText: text,
    TargetLanguage: targetLanguage,
    Timestamp: createTimestamp(),
    Version: '2018-10-12',
  }
  const signature = await signAliyunQuery(parameters, accessKeySecret)
  const signedParameters = { ...parameters, Signature: signature }
  const query = Object.entries(signedParameters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
    .join('&')
  const url = `${endpoint}/?${query}`
  const response = await fetch(url, { method: 'GET' })
  const responseText = await response.text()

  if (!response.ok) {
    throw new Error(`Aliyun Machine Translation ${targetLanguage} failed with HTTP ${response.status}: ${responseText}`)
  }

  const result = JSON.parse(responseText) as {
    Code?: string | number
    Data?: {
      Translated?: string
      TranslatedText?: string
    }
    Message?: string
    RequestId?: string
  }
  const resultCode = result.Code === undefined ? '' : String(result.Code)

  if (resultCode && resultCode !== '200') {
    throw new Error(
      `Aliyun Machine Translation ${targetLanguage} failed: ${resultCode} ${result.Message ?? ''}`.trim(),
    )
  }

  const translatedText = (result.Data?.Translated ?? result.Data?.TranslatedText)?.trim()

  if (!translatedText) {
    throw new Error(`Aliyun Machine Translation ${targetLanguage} returned an empty translation.`)
  }

  return translatedText
}

async function translateWithAliyunRetry(text: string, targetLanguage: TargetLanguage) {
  let lastError: unknown

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await translateWithAliyun(text, targetLanguage)
    } catch (error) {
      lastError = error

      if (!isAliyunRetryableError(error) || attempt === 2) {
        break
      }

      await sleep(700 * (attempt + 1))
    }
  }

  throw lastError
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported.' }, 405)
  }

  try {
    const isAdmin = await assertAdmin(request)

    if (!isAdmin) {
      return jsonResponse({ error: 'NOT_AUTHORIZED', message: 'Only admins can translate product content.' }, 403)
    }

    const input = await request.json() as TranslateRequest
    const text = input.text?.trim() ?? ''

    if (!text) {
      return jsonResponse({
        translations: {
          en: '',
          ru: '',
          uz: '',
          zh: '',
        },
      })
    }

    const en = await translateWithAliyunRetry(text, 'en')
    await sleep(260)
    const ru = await translateWithAliyunRetry(text, 'ru')
    await sleep(260)
    const uz = await translateWithAliyunRetry(text, 'uz')

    return jsonResponse({
      translations: {
        en,
        ru,
        uz,
        zh: text,
      },
    })
  } catch (error) {
    console.error('translate-text failed:', error)

    return jsonResponse(
      {
        error: 'TRANSLATE_TEXT_FAILED',
        message: formatUnknownError(error),
      },
      500,
    )
  }
})
