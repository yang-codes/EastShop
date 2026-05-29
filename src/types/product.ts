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

export type Product = {
  id: string
  name: LocalizedText
  description: LocalizedText
  detail: LocalizedText
  categoryId: string
  price: number
  coverImage?: string
  images: string[]
  specs: ProductSpec[]
  tags: string[]
  sortOrder: number
  isFeatured: boolean
  isActive: boolean
}
