import { getSupabaseClient } from '../lib/supabaseClient'
import type { Category, Product, ProductSpec, ProductVariant } from '../types/product'

const productImagesBucket = 'product-images'

type ProductRow = {
  /** 商品唯一标识，业务上用于详情页深度链接、购物车和订单明细关联。 */
  id: string
  /** 商品所属分类；为空表示未分类，前台分类筛选不会命中。 */
  category_id: string | null
  /** 中文商品名称，用于中文前台和后台编辑。 */
  name_zh: string
  /** 英文商品名称，用于英文前台、订单快照和中亚客户沟通。 */
  name_en: string
  /** 俄文商品名称，用于俄文前台、订单快照和中亚客户沟通。 */
  name_ru: string
  /** 中文短简介，用于商品列表卡片。 */
  description_zh: string
  /** 英文短简介，用于商品列表卡片。 */
  description_en: string
  /** 俄文短简介，用于商品列表卡片。 */
  description_ru: string
  /** 中文详情，用于商品详情页。 */
  detail_zh: string
  /** 英文详情，用于商品详情页。 */
  detail_en: string
  /** 俄文详情，用于商品详情页。 */
  detail_ru: string
  /** 商品主图 URL，用于列表卡片和详情页首图。 */
  cover_image: string | null
  /** 商品主图 URL 列表，用于详情页顶部横向滚动主图画廊。 */
  cover_images?: unknown
  /** 商品图片 URL 列表，后续由 Supabase Storage 上传流程维护。 */
  images: unknown
  /** 商品规格 JSON，保存尺寸、材质、电压等结构化卖点。 */
  specs: unknown
  /** 商品销售规格 JSON，保存可购买规格、规格价格和 SKU。 */
  variants?: unknown
  /** 商品标签 JSON，用于搜索、运营标记和前台标签展示。 */
  tags: unknown
  /** 运营排序值，数字越小越靠前。 */
  sort_order: number
  /** 是否推荐；用于首页推荐和后台筛选。 */
  is_featured: boolean
  /** 是否上架；下架商品不应出现在前台，也不能被新订单购买。 */
  is_active: boolean
}

type CategoryRow = {
  /** 分类唯一标识，用于商品归类和前台筛选。 */
  id: string
  /** 中文分类名称。 */
  name_zh: string
  /** 英文分类名称。 */
  name_en: string
  /** 俄文分类名称。 */
  name_ru: string
  /** 分类展示排序值，数字越小越靠前。 */
  sort_order: number
  /** 是否启用；停用分类不在前台筛选中展示。 */
  is_active: boolean
}

/**
 * 将 Supabase JSON 字段规范化为字符串数组。
 * 业务用途：保护商品图片 URL 列表和商品标签，避免数据库里出现异常 JSON 时影响前台渲染。
 *
 * @param value Supabase 返回的原始 JSON 值。
 * @returns 只包含字符串的数组；如果原始值不是数组则返回空数组。
 */
function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function resolveCoverImages(coverImages: unknown, coverImage?: string | null): string[] {
  const images = asStringArray(coverImages)

  if (images.length > 0) {
    return images
  }

  return coverImage ? [coverImage] : []
}

/**
 * 将商品规格 JSON 规范化为前端可展示的规格数组。
 * 业务用途：商品详情页需要展示尺寸、材质、电压等规格，同时避免异常规格数据导致页面报错。
 *
 * @param value `products.specs` 的原始 JSON 值。
 * @returns 包含 id、label、value 的有效规格数组。
 */
function asProductSpecs(value: unknown): ProductSpec[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is ProductSpec => {
    if (!item || typeof item !== 'object') {
      return false
    }

    const candidate = item as ProductSpec
    return Boolean(candidate.id && candidate.label && candidate.value)
  })
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
      name: variant.name,
      price: Number(variant.price),
      sku: variant.sku,
      sortOrder: Number(variant.sortOrder) || index + 1,
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder)
}

/**
 * 将 Supabase 商品行转换为前端 Product 业务模型。
 * 业务用途：隔离数据库 snake_case 字段，让后台页面和前台商城统一使用 camelCase 商品对象。
 *
 * @param row `products` 表返回的原始行。
 * @returns 后台和前台共同使用的商品对象。
 */
function mapProduct(row: ProductRow): Product {
  const coverImages = resolveCoverImages(row.cover_images, row.cover_image)

  return {
    categoryId: row.category_id ?? '',
    coverImage: row.cover_image ?? coverImages[0],
    coverImages,
    description: {
      en: row.description_en,
      ru: row.description_ru,
      zh: row.description_zh,
    },
    detail: {
      en: row.detail_en,
      ru: row.detail_ru,
      zh: row.detail_zh,
    },
    id: row.id,
    images: asStringArray(row.images),
    isActive: row.is_active,
    isFeatured: row.is_featured,
    name: {
      en: row.name_en,
      ru: row.name_ru,
      zh: row.name_zh,
    },
    sortOrder: row.sort_order,
    specs: asProductSpecs(row.specs),
    tags: asStringArray(row.tags),
    variants: asProductVariants(row.variants),
  }
}

/**
 * 将 Supabase 分类行转换为前端 Category 业务模型。
 * 业务用途：隔离数据库字段，让分类管理和前台筛选器统一使用同一套分类对象。
 *
 * @param row `categories` 表返回的原始行。
 * @returns 后台和前台共同使用的分类对象。
 */
function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    isActive: row.is_active,
    name: {
      en: row.name_en,
      ru: row.name_ru,
      zh: row.name_zh,
    },
    sortOrder: row.sort_order,
  }
}

/**
 * 将前端 Product 模型转换为 Supabase upsert 请求体。
 * 业务用途：把后台商品编辑表单中的三语内容、价格、分类、图片和状态保存回 `products` 表。
 *
 * @param product 后台表单编辑后的商品对象。
 * @returns Supabase PostgREST 可接受的保存请求体。
 */
function toProductPayload(product: Product) {
  return {
    category_id: product.categoryId || null,
    cover_image: product.coverImages[0] ?? product.coverImage ?? null,
    cover_images: product.coverImages,
    description_en: product.description.en,
    description_ru: product.description.ru,
    description_zh: product.description.zh,
    detail_en: product.detail.en,
    detail_ru: product.detail.ru,
    detail_zh: product.detail.zh,
    id: product.id,
    images: product.images,
    is_active: product.isActive,
    is_featured: product.isFeatured,
    name_en: product.name.en,
    name_ru: product.name.ru,
    name_zh: product.name.zh,
    sort_order: product.sortOrder,
    specs: product.specs,
    tags: product.tags,
    variants: product.variants,
  }
}

function sanitizeStorageSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'product'
}

function extensionFromMimeType(type: string) {
  if (type === 'image/jpeg') {
    return 'jpg'
  }

  if (type === 'image/png') {
    return 'png'
  }

  if (type === 'image/gif') {
    return 'gif'
  }

  return 'webp'
}

function getProductImageStoragePath(imageUrl: string) {
  const marker = `/storage/v1/object/public/${productImagesBucket}/`

  try {
    const parsedUrl = new URL(imageUrl)
    const markerIndex = parsedUrl.pathname.indexOf(marker)

    if (markerIndex === -1) {
      return null
    }

    return decodeURIComponent(parsedUrl.pathname.slice(markerIndex + marker.length))
  } catch {
    return null
  }
}

/**
 * 将前端 Category 模型转换为 Supabase upsert 请求体。
 * 业务用途：把后台分类编辑表单中的三语名称、排序和启用状态保存回 `categories` 表。
 *
 * @param category 后台表单编辑后的分类对象。
 * @returns Supabase PostgREST 可接受的保存请求体。
 */
function toCategoryPayload(category: Category) {
  return {
    id: category.id,
    is_active: category.isActive,
    name_en: category.name.en,
    name_ru: category.name.ru,
    name_zh: category.name.zh,
    sort_order: category.sortOrder,
  }
}

export const adminProductService = {
  /**
   * 读取后台商品管理列表，包括已下架商品。
   * 业务用途：运营人员需要同时管理前台可见商品和暂时隐藏的商品。
   *
   * @returns 按 `sort_order` 排序后的商品列表。
   */
  async listProducts(): Promise<Product[]> {
    const { data, error } = await getSupabaseClient().from('products').select('*').order('sort_order')

    if (error) {
      throw error
    }

    return (data as ProductRow[]).map(mapProduct)
  },

  /**
   * 新增或更新商品。
   * 业务用途：保存后台商品编辑中的三语名称、价格、标签、排序、推荐和上下架状态。
   *
   * @param product 后台商品编辑器提交的商品数据。
   * @returns Supabase 保存后返回的商品对象。
   */
  async saveProduct(product: Product): Promise<Product> {
    const { data, error } = await getSupabaseClient()
      .from('products')
      .upsert(toProductPayload(product))
      .select('*')
      .single()

    if (error) {
      throw error
    }

    return mapProduct(data as ProductRow)
  },

  /**
   * 上传商品图片到 Supabase Storage，并返回公开访问 URL。
   * 业务用途：后台商品图片管理把本地文件保存到 `product-images` bucket，再回填到商品主图和图片列表字段。
   *
   * @param productId 商品 ID，用于生成 Storage 路径分组。
   * @param file 已经在浏览器端压缩过的图片文件。
   * @param index 同一次批量上传中的序号，用于避免路径冲突。
   * @returns Supabase Storage public URL。
   */
  async uploadProductImage(productId: string, file: File, index: number): Promise<string> {
    const safeProductId = sanitizeStorageSegment(productId)
    const safeName = sanitizeStorageSegment(file.name.replace(/\.[^.]+$/, ''))
    const extension = extensionFromMimeType(file.type)
    const path = `${safeProductId}/${Date.now()}-${index}-${safeName}.${extension}`
    const client = getSupabaseClient()
    const { error } = await client.storage.from(productImagesBucket).upload(path, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false,
    })

    if (error) {
      throw error
    }

    return client.storage.from(productImagesBucket).getPublicUrl(path).data.publicUrl
  },

  /**
   * 删除商品图片在 Supabase Storage 中的真实文件。
   * 业务用途：后台图片管理删除旧图时，避免只移除商品 URL、但 Storage 中继续残留无用文件。
   *
   * @param imageUrl 商品图片公开 URL。
   * @returns true 表示识别到并删除了 Storage 文件；false 表示不是当前 bucket 的公开 URL。
   */
  async deleteProductImageFile(imageUrl: string): Promise<boolean> {
    const path = getProductImageStoragePath(imageUrl)

    if (!path) {
      return false
    }

    const { error } = await getSupabaseClient().storage.from(productImagesBucket).remove([path])

    if (error) {
      throw error
    }

    return true
  },

  /**
   * 从商品表中永久删除商品。
   * 业务用途：移除不再管理或不再销售的商品；如果商品已有历史订单，通常更建议改为下架。
   *
   * @param productId 要删除的商品 ID。
   */
  async deleteProduct(productId: string) {
    const { error } = await getSupabaseClient().from('products').delete().eq('id', productId)

    if (error) {
      throw error
    }
  },

  /**
   * 更新商品上下架状态。
   * 业务用途：运营人员快速发布或隐藏商品；订单提交服务端仍必须再次校验该状态。
   *
   * @param productId 要发布或隐藏的商品 ID。
   * @param isActive true 表示前台展示，false 表示前台隐藏。
   */
  async setProductActive(productId: string, isActive: boolean) {
    const { error } = await getSupabaseClient().from('products').update({ is_active: isActive }).eq('id', productId)

    if (error) {
      throw error
    }
  },

  /**
   * 按分类批量更新商品上下架状态。
   * 业务用途：分类下架时，分类下所有商品也必须从前台同步隐藏。
   *
   * @param categoryId 要同步更新的分类 ID。
   * @param isActive true 表示前台展示，false 表示前台隐藏。
   */
  async setProductsActiveByCategory(categoryId: string, isActive: boolean) {
    const { error } = await getSupabaseClient().from('products').update({ is_active: isActive }).eq('category_id', categoryId)

    if (error) {
      throw error
    }
  },

  /**
   * 删除分类前，将该分类下商品下架并重置为未分类。
   * 业务用途：分类删除后避免前台仍展示失去分类归属的商品，同时保留商品资料供后台后续重新归类。
   *
   * @param categoryId 即将删除的分类 ID。
   */
  async deactivateAndUnassignProductsByCategory(categoryId: string) {
    const { error } = await getSupabaseClient()
      .from('products')
      .update({ category_id: null, is_active: false })
      .eq('category_id', categoryId)

    if (error) {
      throw error
    }
  },

  /**
   * 读取后台分类管理列表，包括已停用分类。
   * 业务用途：分类管理页和商品分类选择器都需要完整分类数据。
   *
   * @returns 按 `sort_order` 排序后的分类列表。
   */
  async listCategories(): Promise<Category[]> {
    const { data, error } = await getSupabaseClient().from('categories').select('*').order('sort_order')

    if (error) {
      throw error
    }

    return (data as CategoryRow[]).map(mapCategory)
  },

  /**
   * 新增或更新分类。
   * 业务用途：保存前台筛选分类的三语名称、排序和启用状态。
   *
   * @param category 后台分类编辑器提交的分类数据。
   * @returns Supabase 保存后返回的分类对象。
   */
  async saveCategory(category: Category): Promise<Category> {
    const { data, error } = await getSupabaseClient()
      .from('categories')
      .upsert(toCategoryPayload(category))
      .select('*')
      .single()

    if (error) {
      throw error
    }

    return mapCategory(data as CategoryRow)
  },

  /**
   * 从分类表中永久删除分类。
   * 业务用途：移除不再使用的商品分类；如果分类下仍有商品，应先迁移商品分类。
   *
   * @param categoryId 要删除的分类 ID。
   */
  async deleteCategory(categoryId: string) {
    const { error } = await getSupabaseClient().from('categories').delete().eq('id', categoryId)

    if (error) {
      throw error
    }
  },
}
