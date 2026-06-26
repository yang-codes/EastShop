import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient'
import { createLocalizedText } from '../types/language'
import type { Category, LocalizedTags, Product, ProductSpec, ProductVariant } from '../types/product'

type SupabaseCategoryRow = {
  id: string
  name_zh: string
  name_en: string
  name_ru: string
  name_uz?: string | null
  sort_order: number
  is_active: boolean
}

type SupabaseProductRow = {
  id: string
  category_id: string | null
  name_zh: string
  name_en: string
  name_ru: string
  name_uz?: string | null
  description_zh: string
  description_en: string
  description_ru: string
  description_uz?: string | null
  detail_zh: string
  detail_en: string
  detail_ru: string
  detail_uz?: string | null
  cover_image: string | null
  cover_images?: unknown
  images: unknown
  specs: unknown
  variants?: unknown
  tags: unknown
  sort_order: number
  is_featured: boolean
  is_active: boolean
}

async function loadMockData<T>(fileName: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}mock/${fileName}`)

  if (!response.ok) {
    throw new Error(`Failed to load mock data: ${fileName}`)
  }

  return response.json() as Promise<T>
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function asProductTags(value: unknown): LocalizedTags {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    return {
      en: asStringArray(obj['en']),
      ru: asStringArray(obj['ru']),
      uz: asStringArray(obj['uz']),
      zh: asStringArray(obj['zh']),
    }
  }

  const legacy = asStringArray(value)
  return { en: legacy, ru: legacy, uz: legacy, zh: legacy }
}

function resolveCoverImages(coverImages: unknown, coverImage?: string | null): string[] {
  const images = asStringArray(coverImages)

  if (images.length > 0) {
    return images
  }

  return coverImage ? [coverImage] : []
}

function normalizeProduct(product: Product): Product {
  const coverImages = product.coverImages?.length ? product.coverImages : product.coverImage ? [product.coverImage] : []
  const variants = product.variants?.length ? product.variants : []

  return {
    ...product,
    coverImage: product.coverImage ?? coverImages[0],
    coverImages,
    variants,
  }
}

function asProductSpecs(value: unknown): ProductSpec[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is ProductSpec => {
      if (!item || typeof item !== 'object') {
        return false
      }

      const candidate = item as ProductSpec
      return Boolean(candidate.id && candidate.label && candidate.value)
    })
    .map((spec) => ({
      ...spec,
      label: createLocalizedText(spec.label),
      value: createLocalizedText(spec.value),
    }))
}

function asProductVariants(value: unknown): ProductVariant[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is ProductVariant => {
      if (!item || typeof item !== 'object') {
        return false
      }

      const candidate = item as ProductVariant
      return Boolean(candidate.id && candidate.name && Number.isFinite(Number(candidate.price)))
    })
    .map((variant, index) => ({
      id: variant.id,
      isActive: variant.isActive ?? true,
      isDefault: variant.isDefault ?? index === 0,
      name: createLocalizedText(variant.name),
      price: Number(variant.price),
      sku: variant.sku,
      sortOrder: Number(variant.sortOrder) || index + 1,
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder)
}

function mapCategory(row: SupabaseCategoryRow): Category {
  return {
    id: row.id,
    isActive: row.is_active,
    name: createLocalizedText({
      en: row.name_en,
      ru: row.name_ru,
      uz: row.name_uz ?? row.name_zh,
      zh: row.name_zh,
    }),
    sortOrder: row.sort_order,
  }
}

function mapProduct(row: SupabaseProductRow): Product {
  const coverImages = resolveCoverImages(row.cover_images, row.cover_image)

  return {
    categoryId: row.category_id ?? '',
    coverImage: row.cover_image ?? coverImages[0],
    coverImages,
    description: createLocalizedText({
      en: row.description_en,
      ru: row.description_ru,
      uz: row.description_uz ?? row.description_zh,
      zh: row.description_zh,
    }),
    detail: createLocalizedText({
      en: row.detail_en,
      ru: row.detail_ru,
      uz: row.detail_uz ?? row.detail_zh,
      zh: row.detail_zh,
    }),
    id: row.id,
    images: asStringArray(row.images),
    isActive: row.is_active,
    isFeatured: row.is_featured,
    name: createLocalizedText({
      en: row.name_en,
      ru: row.name_ru,
      uz: row.name_uz ?? row.name_zh,
      zh: row.name_zh,
    }),
    sortOrder: row.sort_order,
    specs: asProductSpecs(row.specs),
    tags: asProductTags(row.tags),
    variants: asProductVariants(row.variants),
  }
}

export const catalogService = {
  /**
   * 按商品 ID 读取一个已上架商品，用于前台商品详情页。
   * 业务用途：用户点击商品卡片后进入详情页，只允许展示仍然上架的商品。
   * 未配置 Supabase 时从 mock 商品数据中读取，便于本地开发和演示。
   */
  async getProductById(productId: string): Promise<Product | null> {
    if (!isSupabaseConfigured()) {
      const products = await this.listActiveProducts()
      return products.find((product) => product.id === productId) ?? null
    }

    const { data, error } = await getSupabaseClient()
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      throw error
    }

    return data ? mapProduct(data as SupabaseProductRow) : null
  },

  /**
   * 按展示顺序读取已启用分类。
   * 业务用途：前台分类筛选器和后台预览只展示可用分类。
   * 未配置 Supabase 时读取 public/mock/categories.json。
   */
  async listActiveCategories(): Promise<Category[]> {
    if (!isSupabaseConfigured()) {
      return loadMockData<Category[]>('categories.json')
    }

    const { data, error } = await getSupabaseClient()
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')

    if (error) {
      throw error
    }

    return (data as SupabaseCategoryRow[]).map(mapCategory)
  },

  /**
   * 按展示顺序读取已上架商品。
   * 业务用途：前台商品列表只展示当前可售商品，避免用户购买已下架商品。
   * 未配置 Supabase 时读取 public/mock/products.json。
   */
  async listActiveProducts(): Promise<Product[]> {
    if (!isSupabaseConfigured()) {
      const products = await loadMockData<Product[]>('products.json')
      return products.map(normalizeProduct)
    }

    const { data, error } = await getSupabaseClient()
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')

    if (error) {
      throw error
    }

    return (data as SupabaseProductRow[]).map(mapProduct)
  },
}
