import type { LocalizedText } from './language'

export type Category = {
  id: string
  name: LocalizedText
  sortOrder: number
  isActive: boolean
}

export type ProductSpec = {
  id: string
  label: LocalizedText
  value: LocalizedText
}

export type ProductVariant = {
  id: string
  name: LocalizedText
  price: number
  sortOrder: number
  isDefault: boolean
  isActive: boolean
  sku?: string
}

export type Product = {
  id: string
  name: LocalizedText
  description: LocalizedText
  detail: LocalizedText
  categoryId: string
  coverImage?: string
  coverImages: string[]
  images: string[]
  specs: ProductSpec[]
  variants: ProductVariant[]
  tags: string[]
  sortOrder: number
  isFeatured: boolean
  isActive: boolean
}
