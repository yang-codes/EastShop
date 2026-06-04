import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

type TranslateRequest = {
  text?: string
}

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

function isTencentRateLimitError(error: unknown) {
  return formatUnknownError(error).includes('RequestLimitExceeded')
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

function bytesToHex(bytes: ArrayBuffer | Uint8Array) {
  return Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256Hex(value: string) {
  return bytesToHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
}

async function hmacSha256(key: string | Uint8Array, value: string) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? new TextEncoder().encode(key) : key,
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value))
  return new Uint8Array(signature)
}

async function translateWithTencentCloud(text: string, targetLang: 'en' | 'ru') {
  const secretId = Deno.env.get('TENCENTCLOUD_SECRET_ID')
  const secretKey = Deno.env.get('TENCENTCLOUD_SECRET_KEY')
  const region = Deno.env.get('TENCENT_TRANSLATE_REGION') ?? 'ap-guangzhou'
  const endpoint = 'tmt.tencentcloudapi.com'
  const service = 'tmt'
  const action = 'TextTranslate'
  const version = '2018-03-21'
  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)

  if (!secretId || !secretKey) {
    throw new Error('TENCENTCLOUD_SECRET_ID or TENCENTCLOUD_SECRET_KEY is not configured.')
  }

  const payload = JSON.stringify({
    ProjectId: 0,
    Source: 'zh',
    SourceText: text,
    Target: targetLang,
  })
  const hashedPayload = await sha256Hex(payload)
  const canonicalHeaders = [
    'content-type:application/json; charset=utf-8',
    `host:${endpoint}`,
    `x-tc-action:${action.toLowerCase()}`,
    '',
  ].join('\n')
  const signedHeaders = 'content-type;host;x-tc-action'
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    hashedPayload,
  ].join('\n')
  const credentialScope = `${date}/${service}/tc3_request`
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n')
  const secretDate = await hmacSha256(`TC3${secretKey}`, date)
  const secretService = await hmacSha256(secretDate, service)
  const secretSigning = await hmacSha256(secretService, 'tc3_request')
  const signature = bytesToHex(await hmacSha256(secretSigning, stringToSign))
  const authorization = [
    `Credential=${secretId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ')
  const authorizationHeader = `TC3-HMAC-SHA256 ${authorization}`

  const response = await fetch(`https://${endpoint}`, {
    body: payload,
    headers: {
      Authorization: authorizationHeader,
      'Content-Type': 'application/json; charset=utf-8',
      Host: endpoint,
      'X-TC-Action': action,
      'X-TC-Region': region,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Version': version,
    },
    method: 'POST',
  })

  const responseText = await response.text()

  if (!response.ok) {
    throw new Error(`Tencent Cloud TMT ${targetLang} failed with HTTP ${response.status}: ${responseText}`)
  }

  const result = JSON.parse(responseText) as {
    Response?: {
      Error?: { Code?: string; Message?: string }
      TargetText?: string
    }
  }

  if (result.Response?.Error) {
    throw new Error(
      `Tencent Cloud TMT ${targetLang} failed: ${result.Response.Error.Code ?? 'UNKNOWN'} ${result.Response.Error.Message ?? ''}`.trim(),
    )
  }

  const translatedText = result.Response?.TargetText?.trim()

  if (!translatedText) {
    throw new Error(`Tencent Cloud TMT ${targetLang} returned an empty translation.`)
  }

  return translatedText
}

async function translateWithTencentCloudRetry(text: string, targetLang: 'en' | 'ru') {
  let lastError: unknown

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await translateWithTencentCloud(text, targetLang)
    } catch (error) {
      lastError = error

      if (!isTencentRateLimitError(error) || attempt === 2) {
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
          zh: '',
        },
      })
    }

    const en = await translateWithTencentCloudRetry(text, 'en')
    await sleep(260)
    const ru = await translateWithTencentCloudRetry(text, 'ru')

    return jsonResponse({
      translations: {
        en,
        ru,
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
