import type { SupportedLanguage } from './language'

export type EntrySource = 'telegram' | 'instagram' | 'web'

export type OrderStatus = 'new' | 'contacted' | 'fulfilled' | 'cancelled'

export type CheckoutContact = {
  name: string
  phone: string
  address: string
  note?: string
  socialPlatform?: string
  socialHandle?: string
}

export type LocationSnapshot = {
  latitude?: number
  longitude?: number
  accuracy?: number
  country?: string
  city?: string
  district?: string
  street?: string
  formattedAddress?: string
}

export type OrderItemSnapshot = {
  productId: string
  productName: string
  language: SupportedLanguage
  variantId?: string
  variantName?: string
  unitPrice: number
  quantity: number
  subtotal: number
}

export type Order = {
  id: string
  source: EntrySource
  status: OrderStatus
  contact: CheckoutContact
  location?: LocationSnapshot
  items: OrderItemSnapshot[]
  total: number
  createdAt: string
}
