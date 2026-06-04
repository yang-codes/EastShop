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
    const phone = normalizePhone(input.phone ?? '')
    const orderId = input.orderId?.trim()
    const socialHandle = normalizeSocial(input.socialHandle ?? '')

    if (!phone) {
      throw new ResponseError('PHONE_REQUIRED', 'Mobile phone is required.', 400)
    }

    if (!orderId && !socialHandle) {
      throw new ResponseError('LOOKUP_KEY_REQUIRED', 'Order ID or social account is required.', 400)
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    })

    let query = supabase
      .from('orders')
      .select(
        `
          id,
          source,
          status,
          customer_name,
          phone,
          address,
          note,
          social_handle,
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
        `,
      )
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
