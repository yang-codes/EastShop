import imageCompression from 'browser-image-compression'
import { CircleCheck, ImagePlus, Languages, Plus, Save, Search, Star, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/PageHeader'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { adminProductService } from '../../services/adminProductService'
import { catalogService } from '../../services/catalogService'
import { translationService } from '../../services/translationService'
import { resolveSupportedLanguage } from '../../types/language'
import type { Category, Product, ProductSpec, ProductVariant } from '../../types/product'
import { scrollAdminPageToTop } from '../../utils/adminScroll'

type ProductSpecDraft = {
  id: string
  labelEn: string
  labelRu: string
  labelUz: string
  labelZh: string
  valueEn: string
  valueRu: string
  valueUz: string
  valueZh: string
}

type ProductVariantDraft = {
  id: string
  isActive: boolean
  isDefault: boolean
  nameEn: string
  nameRu: string
  nameUz: string
  nameZh: string
  price: string
  sku: string
  sortOrder: string
}

type ImageListField = 'coverImagesText' | 'imagesText'
type AutoFillModule = 'name' | 'description' | 'detail' | 'specs' | 'variants'

type ProductDraft = {
  categoryId: string
  coverImagesText: string
  descriptionEn: string
  descriptionRu: string
  descriptionUz: string
  descriptionZh: string
  detailEn: string
  detailRu: string
  detailUz: string
  detailZh: string
  id: string
  imagesText: string
  isActive: boolean
  isFeatured: boolean
  nameEn: string
  nameRu: string
  nameUz: string
  nameZh: string
  sortOrder: string
  specs: ProductSpecDraft[]
  tagsText: string
  variants: ProductVariantDraft[]
}

const coverImageMaxWidth = 1200
const detailImageMaxWidth = 1200

function resolveLanguage(language: string) {
  return resolveSupportedLanguage(language)
}

function createId(seed: string) {
  const slug = seed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `${slug || 'product'}-${Date.now()}`
}

function createSpecId(seed: string) {
  const slug = seed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return slug || `spec-${Date.now()}`
}

function specToDraft(spec: ProductSpec): ProductSpecDraft {
  return {
    id: spec.id,
    labelEn: spec.label.en,
    labelRu: spec.label.ru,
    labelUz: spec.label.uz,
    labelZh: spec.label.zh,
    valueEn: spec.value.en,
    valueRu: spec.value.ru,
    valueUz: spec.value.uz,
    valueZh: spec.value.zh,
  }
}

function draftSpecToSpec(spec: ProductSpecDraft): ProductSpec | null {
  const hasContent = [
    spec.labelEn,
    spec.labelRu,
    spec.labelUz,
    spec.labelZh,
    spec.valueEn,
    spec.valueRu,
    spec.valueUz,
    spec.valueZh,
  ].some((value) => value.trim())

  if (!hasContent) {
    return null
  }

  return {
    id: spec.id || createSpecId(spec.labelEn || spec.labelZh || spec.labelRu || spec.labelUz),
    label: {
      en: spec.labelEn,
      ru: spec.labelRu,
      uz: spec.labelUz,
      zh: spec.labelZh,
    },
    value: {
      en: spec.valueEn,
      ru: spec.valueRu,
      uz: spec.valueUz,
      zh: spec.valueZh,
    },
  }
}

function variantToDraft(variant: ProductVariant): ProductVariantDraft {
  return {
    id: variant.id,
    isActive: variant.isActive,
    isDefault: variant.isDefault,
    nameEn: variant.name.en,
    nameRu: variant.name.ru,
    nameUz: variant.name.uz,
    nameZh: variant.name.zh,
    price: String(variant.price),
    sku: variant.sku ?? '',
    sortOrder: String(variant.sortOrder),
  }
}

function draftVariantToVariant(variant: ProductVariantDraft): ProductVariant | null {
  const nameZh = variant.nameZh.trim()
  const hasContent = [variant.nameEn, variant.nameRu, variant.nameUz, variant.nameZh, variant.price, variant.sku].some((value) => value.trim())

  if (!hasContent) {
    return null
  }

  return {
    id: variant.id || createSpecId(nameZh || variant.nameEn || variant.nameRu || variant.nameUz || variant.sku),
    isActive: variant.isActive,
    isDefault: variant.isDefault,
    name: {
      en: variant.nameEn.trim() || nameZh,
      ru: variant.nameRu.trim() || nameZh,
      uz: variant.nameUz.trim() || nameZh,
      zh: nameZh,
    },
    price: Number(variant.price) || 0,
    sku: variant.sku.trim() || undefined,
    sortOrder: Number(variant.sortOrder) || 1,
  }
}

function isEmptyVariantDraft(variant: ProductVariantDraft) {
  return [variant.nameEn, variant.nameRu, variant.nameUz, variant.nameZh, variant.price, variant.sku].every((value) => !value.trim())
}

function validateProductDraft(draft: ProductDraft) {
  const contentVariants = draft.variants.filter((variant) => !isEmptyVariantDraft(variant))

  for (const [index, variant] of contentVariants.entries()) {
    const hasDisplayName = Boolean(variant.nameZh.trim() || variant.nameEn.trim())
    const price = Number(variant.price)

    if (!hasDisplayName) {
      return `Variant ${index + 1}: enter a Chinese or English name.`
    }

    if (!Number.isFinite(price) || price <= 0) {
      return `Variant ${index + 1}: price must be greater than 0.`
    }
  }

  if (draft.isActive && !contentVariants.some((variant) => variant.isActive)) {
    return 'Active products need at least one enabled purchasable variant.'
  }

  if (contentVariants.filter((variant) => variant.isDefault).length > 1) {
    return 'Only one sales variant can be marked as default.'
  }

  return ''
}

function getAdminErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (error && typeof error === 'object') {
    const errorRecord = error as Record<string, unknown>
    const parts = ['message', 'details', 'hint', 'code']
      .map((key) => errorRecord[key])
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

    if (parts.length > 0) {
      return parts.join(' ')
    }

    try {
      return JSON.stringify(error)
    } catch {
      return '操作失败，请检查控制台或 Supabase 配置。'
    }
  }

  return typeof error === 'string' ? error : '操作失败，请稍后重试。'
}

function createEmptyDraft(sortOrder: number): ProductDraft {
  return {
    categoryId: '',
    coverImagesText: '',
    descriptionEn: '',
    descriptionRu: '',
    descriptionUz: '',
    descriptionZh: '',
    detailEn: '',
    detailRu: '',
    detailUz: '',
    detailZh: '',
    id: '',
    imagesText: '',
    isActive: true,
    isFeatured: false,
    nameEn: '',
    nameRu: '',
    nameUz: '',
    nameZh: '',
    sortOrder: String(sortOrder),
    specs: [],
    tagsText: '',
    variants: [],
  }
}

function productToDraft(product: Product): ProductDraft {
  return {
    categoryId: product.categoryId,
    coverImagesText: (product.coverImages.length > 0 ? product.coverImages : product.coverImage ? [product.coverImage] : []).join('\n'),
    descriptionEn: product.description.en,
    descriptionRu: product.description.ru,
    descriptionUz: product.description.uz,
    descriptionZh: product.description.zh,
    detailEn: product.detail.en,
    detailRu: product.detail.ru,
    detailUz: product.detail.uz,
    detailZh: product.detail.zh,
    id: product.id,
    imagesText: product.images.join('\n'),
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    nameEn: product.name.en,
    nameRu: product.name.ru,
    nameUz: product.name.uz,
    nameZh: product.name.zh,
    sortOrder: String(product.sortOrder),
    specs: product.specs.map(specToDraft),
    tagsText: product.tags.join(', '),
    variants: product.variants.map(variantToDraft),
  }
}

function draftToProduct(draft: ProductDraft): Product {
  const nameZh = draft.nameZh.trim()
  const descriptionZh = draft.descriptionZh.trim()
  const detailZh = draft.detailZh.trim()
  const id = draft.id || createId(nameZh || draft.nameEn || draft.nameRu)
  const images = draft.imagesText
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
  const coverImages = draft.coverImagesText
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
  const coverImage = coverImages[0]
  const variants = draft.variants
    .map(draftVariantToVariant)
    .filter((variant): variant is ProductVariant => Boolean(variant))
    .map((variant, index, list) => ({
      ...variant,
      isDefault: list.some((item) => item.isDefault) ? variant.isDefault : index === 0,
      sortOrder: variant.sortOrder || index + 1,
    }))

  return {
    categoryId: draft.categoryId,
    coverImage,
    coverImages,
    description: {
      en: draft.descriptionEn.trim() || descriptionZh,
      ru: draft.descriptionRu.trim() || descriptionZh,
      uz: draft.descriptionUz.trim() || descriptionZh,
      zh: descriptionZh,
    },
    detail: {
      en: draft.detailEn.trim() || detailZh,
      ru: draft.detailRu.trim() || detailZh,
      uz: draft.detailUz.trim() || detailZh,
      zh: detailZh,
    },
    id,
    images,
    isActive: draft.isActive,
    isFeatured: draft.isFeatured,
    name: {
      en: draft.nameEn.trim() || nameZh,
      ru: draft.nameRu.trim() || nameZh,
      uz: draft.nameUz.trim() || nameZh,
      zh: nameZh,
    },
    sortOrder: Number(draft.sortOrder) || 0,
    specs: draft.specs.map(draftSpecToSpec).filter((spec): spec is ProductSpec => Boolean(spec)),
    tags: draft.tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    variants,
  }
}

function parseImageUrlText(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function canDeleteStorageImage(imageUrl: string) {
  return imageUrl.includes('/storage/v1/object/public/product-images/')
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export function AdminProductsPage() {
  const { i18n, t } = useTranslation()
  const coverImageInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [activeStatus, setActiveStatus] = useState('all')
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [draft, setDraft] = useState<ProductDraft>(() => createEmptyDraft(1))
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingCoverImage, setIsUploadingCoverImage] = useState(false)
  const [isUploadingImages, setIsUploadingImages] = useState(false)
  const [autoFillingModule, setAutoFillingModule] = useState<AutoFillModule | null>(null)
  const [deletingImageUrl, setDeletingImageUrl] = useState('')
  const [draggingImage, setDraggingImage] = useState<{ field: ImageListField; url: string } | null>(null)

  const language = resolveLanguage(i18n.language)

  async function loadAdminCatalog() {
    setErrorMessage('')

    try {
      const [nextProducts, nextCategories] = isSupabaseConfigured()
        ? await Promise.all([adminProductService.listProducts(), adminProductService.listCategories()])
        : await Promise.all([catalogService.listActiveProducts(), catalogService.listActiveCategories()])

      setProducts(nextProducts)
      setCategories(nextCategories)

      const nextSelectedId = selectedProductId || nextProducts[0]?.id || ''
      setSelectedProductId(nextSelectedId)
      setDraft(nextProducts.find((product) => product.id === nextSelectedId) ? productToDraft(nextProducts.find((product) => product.id === nextSelectedId) as Product) : createEmptyDraft(nextProducts.length + 1))
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error))
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadAdminCatalog())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name[language]])),
    [categories, language],
  )

  const filteredProducts = products.filter((product) => {
    const normalizedQuery = query.trim().toLowerCase()
    const matchesQuery =
      !normalizedQuery ||
      product.name[language].toLowerCase().includes(normalizedQuery) ||
      product.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
    const matchesCategory = categoryId === 'all' || product.categoryId === categoryId
    const matchesActiveStatus = activeStatus === 'all' || (activeStatus === 'active' ? product.isActive : !product.isActive)
    const matchesFeatured = !featuredOnly || product.isFeatured

    return matchesQuery && matchesCategory && matchesActiveStatus && matchesFeatured
  })

  const selectedProduct = products.find((product) => product.id === selectedProductId)
  const coverImageUrls = useMemo(() => parseImageUrlText(draft.coverImagesText), [draft.coverImagesText])
  const detailImageUrls = useMemo(() => parseImageUrlText(draft.imagesText), [draft.imagesText])
  const activeCount = products.filter((product) => product.isActive).length
  const featuredCount = products.filter((product) => product.isFeatured).length

  function selectProduct(product: Product) {
    setSelectedProductId(product.id)
    setDraft(productToDraft(product))
    setStatusMessage('')
    setErrorMessage('')
  }

  function startNewProduct() {
    setSelectedProductId('')
    setDraft(createEmptyDraft(products.length + 1))
    setStatusMessage('')
    setErrorMessage('')
  }

  function updateDraft<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function addSpec() {
    setDraft((current) => ({
      ...current,
      specs: [
        ...current.specs,
        {
          id: `spec-${Date.now()}`,
          labelEn: '',
          labelRu: '',
          labelUz: '',
          labelZh: '',
          valueEn: '',
          valueRu: '',
          valueUz: '',
          valueZh: '',
        },
      ],
    }))
  }

  function removeSpec(specId: string) {
    setDraft((current) => ({
      ...current,
      specs: current.specs.filter((spec) => spec.id !== specId),
    }))
  }

  function updateSpec(specId: string, key: keyof ProductSpecDraft, value: string) {
    setDraft((current) => ({
      ...current,
      specs: current.specs.map((spec) => (spec.id === specId ? { ...spec, [key]: value } : spec)),
    }))
  }

  function addVariant() {
    setDraft((current) => ({
      ...current,
      variants: [
        ...current.variants,
        {
          id: `variant-${Date.now()}`,
          isActive: true,
          isDefault: current.variants.length === 0,
          nameEn: '',
          nameRu: '',
          nameUz: '',
          nameZh: '',
          price: '0',
          sku: '',
          sortOrder: String(current.variants.length + 1),
        },
      ],
    }))
  }

  function removeVariant(variantId: string) {
    setDraft((current) => ({
      ...current,
      variants: current.variants.filter((variant) => variant.id !== variantId),
    }))
  }

  function updateVariant(variantId: string, key: keyof ProductVariantDraft, value: ProductVariantDraft[keyof ProductVariantDraft]) {
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant) => {
        if (variant.id !== variantId) {
          return variant
        }

        if (key === 'isDefault' && value === true) {
          return { ...variant, isDefault: true }
        }

        return { ...variant, [key]: value }
      }).map((variant) => (key === 'isDefault' && value === true && variant.id !== variantId ? { ...variant, isDefault: false } : variant)),
    }))
  }

  async function translateTextWithGap(text: string) {
    const translated = await translationService.translateFromChinese(text)
    await wait(350)
    return translated
  }

  async function handleAutoFillBasicField(module: Extract<AutoFillModule, 'name' | 'description' | 'detail'>) {
    const fieldMap = {
      description: {
        doneMessage: '已补齐简介的英文、俄文和乌兹语字段，请检查后保存。',
        enKey: 'descriptionEn',
        requiresMessage: '请先填写中文简介。',
        ruKey: 'descriptionRu',
        uzKey: 'descriptionUz',
        zhKey: 'descriptionZh',
      },
      detail: {
        doneMessage: '已补齐详情的英文、俄文和乌兹语字段，请检查后保存。',
        enKey: 'detailEn',
        requiresMessage: '请先填写中文详情。',
        ruKey: 'detailRu',
        uzKey: 'detailUz',
        zhKey: 'detailZh',
      },
      name: {
        doneMessage: '已补齐名称的英文、俄文和乌兹语字段，请检查后保存。',
        enKey: 'nameEn',
        requiresMessage: '请先填写中文名称。',
        ruKey: 'nameRu',
        uzKey: 'nameUz',
        zhKey: 'nameZh',
      },
    } satisfies Record<Extract<AutoFillModule, 'name' | 'description' | 'detail'>, {
      doneMessage: string
      enKey: keyof ProductDraft
      requiresMessage: string
      ruKey: keyof ProductDraft
      uzKey: keyof ProductDraft
      zhKey: keyof ProductDraft
    }>
    const config = fieldMap[module]
    const sourceText = String(draft[config.zhKey]).trim()

    if (!sourceText) {
      setErrorMessage(config.requiresMessage)
      return
    }

    setAutoFillingModule(module)
    setErrorMessage('')
    setStatusMessage('')

    try {
      const translated = await translateTextWithGap(sourceText)

      setDraft((current) => ({
        ...current,
        [config.enKey]: String(current[config.enKey]).trim() ? current[config.enKey] : translated.en,
        [config.ruKey]: String(current[config.ruKey]).trim() ? current[config.ruKey] : translated.ru,
        [config.uzKey]: String(current[config.uzKey]).trim() ? current[config.uzKey] : translated.uz,
      }))
      setStatusMessage(config.doneMessage)
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error))
    } finally {
      setAutoFillingModule(null)
    }
  }

  async function handleAutoFillSpecs() {
    const specsWithChinese = draft.specs.filter((spec) => spec.labelZh.trim() || spec.valueZh.trim())

    if (specsWithChinese.length === 0) {
      setErrorMessage('请先填写至少一个中文规格属性名或属性值。')
      return
    }

    setAutoFillingModule('specs')
    setErrorMessage('')
    setStatusMessage('')

    try {
      const translatedSpecs: Record<string, Partial<Pick<ProductSpecDraft, 'labelEn' | 'labelRu' | 'labelUz' | 'valueEn' | 'valueRu' | 'valueUz'>>> = {}

      for (const spec of specsWithChinese) {
        const translated: Partial<Pick<ProductSpecDraft, 'labelEn' | 'labelRu' | 'labelUz' | 'valueEn' | 'valueRu' | 'valueUz'>> = {}

        if (spec.labelZh.trim() && (!spec.labelEn.trim() || !spec.labelRu.trim() || !spec.labelUz.trim())) {
          const label = await translateTextWithGap(spec.labelZh)
          translated.labelEn = label.en
          translated.labelRu = label.ru
          translated.labelUz = label.uz
        }

        if (spec.valueZh.trim() && (!spec.valueEn.trim() || !spec.valueRu.trim() || !spec.valueUz.trim())) {
          const value = await translateTextWithGap(spec.valueZh)
          translated.valueEn = value.en
          translated.valueRu = value.ru
          translated.valueUz = value.uz
        }

        translatedSpecs[spec.id] = translated
      }

      setDraft((current) => ({
        ...current,
        specs: current.specs.map((spec) => {
          const translated = translatedSpecs[spec.id]

          if (!translated) {
            return spec
          }

          return {
            ...spec,
            labelEn: spec.labelEn.trim() ? spec.labelEn : translated.labelEn ?? spec.labelEn,
            labelRu: spec.labelRu.trim() ? spec.labelRu : translated.labelRu ?? spec.labelRu,
            labelUz: spec.labelUz.trim() ? spec.labelUz : translated.labelUz ?? spec.labelUz,
            valueEn: spec.valueEn.trim() ? spec.valueEn : translated.valueEn ?? spec.valueEn,
            valueRu: spec.valueRu.trim() ? spec.valueRu : translated.valueRu ?? spec.valueRu,
            valueUz: spec.valueUz.trim() ? spec.valueUz : translated.valueUz ?? spec.valueUz,
          }
        }),
      }))
      setStatusMessage('已补齐规格属性的空白英文、俄文和乌兹语字段，请检查后保存。')
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error))
    } finally {
      setAutoFillingModule(null)
    }
  }

  async function handleAutoFillVariants() {
    const variantsWithChinese = draft.variants.filter((variant) => variant.nameZh.trim())

    if (variantsWithChinese.length === 0) {
      setErrorMessage('请先填写至少一个中文销售规格名。')
      return
    }

    setAutoFillingModule('variants')
    setErrorMessage('')
    setStatusMessage('')

    try {
      const translatedVariants: Record<string, { nameEn: string; nameRu: string; nameUz: string }> = {}

      for (const variant of variantsWithChinese) {
        if (variant.nameEn.trim() && variant.nameRu.trim() && variant.nameUz.trim()) {
          continue
        }

        const translated = await translateTextWithGap(variant.nameZh)
        translatedVariants[variant.id] = {
          nameEn: translated.en,
          nameRu: translated.ru,
          nameUz: translated.uz,
        }
      }

      setDraft((current) => ({
        ...current,
        variants: current.variants.map((variant) => {
          const translated = translatedVariants[variant.id]

          if (!translated) {
            return variant
          }

          return {
            ...variant,
            nameEn: variant.nameEn.trim() ? variant.nameEn : translated.nameEn,
            nameRu: variant.nameRu.trim() ? variant.nameRu : translated.nameRu,
            nameUz: variant.nameUz.trim() ? variant.nameUz : translated.nameUz,
          }
        }),
      }))
      setStatusMessage('已补齐销售规格的空白英文、俄文和乌兹语字段，请检查后保存。')
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error))
    } finally {
      setAutoFillingModule(null)
    }
  }

  async function compressProductImage(file: File, maxWidthOrHeight: number) {
    const compressedFile = await imageCompression(file, {
      fileType: 'image/webp',
      initialQuality: 0.82,
      maxSizeMB: 1.5,
      maxWidthOrHeight,
      useWebWorker: true,
    })

    if (compressedFile.size > 2 * 1024 * 1024) {
      throw new Error(`${file.name} 压缩后仍超过 2 MB，请换一张更小的图片。`)
    }

    return compressedFile
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setStatusMessage('')

    const validationError = validateProductDraft(draft)

    if (validationError) {
      setErrorMessage(validationError)
      scrollAdminPageToTop()
      return
    }

    setIsSaving(true)

    const product = draftToProduct(draft)

    try {
      const savedProduct = isSupabaseConfigured() ? await adminProductService.saveProduct(product) : product

      setProducts((current) => {
        const exists = current.some((item) => item.id === savedProduct.id)
        const nextProducts = exists
          ? current.map((item) => (item.id === savedProduct.id ? savedProduct : item))
          : [...current, savedProduct]

        return nextProducts.sort((left, right) => left.sortOrder - right.sortOrder)
      })
      setSelectedProductId(savedProduct.id)
      setDraft(productToDraft(savedProduct))
      const nextStatusMessage = isSupabaseConfigured() ? t('admin.saved') : t('admin.savedLocally')
      setStatusMessage(nextStatusMessage)
      scrollAdminPageToTop()
      window.alert(nextStatusMessage)
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedProduct) {
      return
    }

    const productName = selectedProduct.name[language] || selectedProduct.name.zh || selectedProduct.id
    const confirmed = window.confirm(t('admin.confirmDeleteProduct', { name: productName }))

    if (!confirmed) {
      return
    }

    setErrorMessage('')
    setStatusMessage('')

    try {
      if (isSupabaseConfigured()) {
        await adminProductService.deleteProduct(selectedProduct.id)
      }

      setProducts((current) => current.filter((product) => product.id !== selectedProduct.id))
      const nextProduct = products.find((product) => product.id !== selectedProduct.id)
      setSelectedProductId(nextProduct?.id ?? '')
      setDraft(nextProduct ? productToDraft(nextProduct) : createEmptyDraft(1))
      setStatusMessage(isSupabaseConfigured() ? t('admin.deleted') : t('admin.deletedLocally'))
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error))
    }
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''

    if (files.length === 0) {
      return
    }

    if (!isSupabaseConfigured()) {
      setErrorMessage('请先配置 Supabase 后再上传商品图片。')
      return
    }

    if (!draft.id.trim()) {
      setErrorMessage('请先填写商品 ID 后再上传图片。')
      return
    }

    setIsUploadingImages(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      const uploadedUrls: string[] = []

      for (const [index, file] of files.entries()) {
        const compressedFile = await compressProductImage(file, detailImageMaxWidth)
        const uploadedUrl = await adminProductService.uploadProductImage(draft.id, compressedFile, index)
        uploadedUrls.push(uploadedUrl)
      }

      setDraft((current) => {
        const currentImages = current.imagesText
          .split('\n')
          .map((image) => image.trim())
          .filter(Boolean)
        const nextImages = Array.from(new Set([...currentImages, ...uploadedUrls]))

        return {
          ...current,
          imagesText: nextImages.join('\n'),
        }
      })
      const nextStatusMessage = `已上传 ${uploadedUrls.length} 张详情页图片，请保存商品以写入图片 URL。`
      setStatusMessage(nextStatusMessage)
      window.alert(nextStatusMessage)
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error))
    } finally {
      setIsUploadingImages(false)
    }
  }

  async function handleCoverImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''

    if (files.length === 0) {
      return
    }

    if (!isSupabaseConfigured()) {
      setErrorMessage('请先配置 Supabase 后再上传商品图片。')
      return
    }

    const productId = draft.id.trim() || createId(draft.nameEn || draft.nameZh || draft.nameRu)

    setIsUploadingCoverImage(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      const uploadedUrls: string[] = []

      for (const [index, file] of files.entries()) {
        const compressedFile = await compressProductImage(file, coverImageMaxWidth)
        const uploadedUrl = await adminProductService.uploadProductImage(productId, compressedFile, index)
        uploadedUrls.push(uploadedUrl)
      }

      setDraft((current) => {
        const currentImages = current.coverImagesText
          .split('\n')
          .map((image) => image.trim())
          .filter(Boolean)
        const nextImages = Array.from(new Set([...currentImages, ...uploadedUrls]))

        return {
          ...current,
          coverImagesText: nextImages.join('\n'),
          id: current.id || productId,
        }
      })
      const nextStatusMessage = `已上传 ${uploadedUrls.length} 张主图，请保存商品以写入数据库。详情页图片请使用下方图片 URL 列表。`
      setStatusMessage(nextStatusMessage)
      window.alert(nextStatusMessage)
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error))
    } finally {
      setIsUploadingCoverImage(false)
    }
  }

  function handleImageDragStart(event: DragEvent<HTMLElement>, field: ImageListField, imageUrl: string) {
    setDraggingImage({ field, url: imageUrl })
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', imageUrl)
  }

  function handleImageDragOver(event: DragEvent<HTMLElement>, field: ImageListField) {
    if (draggingImage?.field !== field) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function handleImageDrop(event: DragEvent<HTMLElement>, field: ImageListField, targetUrl: string) {
    event.preventDefault()

    if (!draggingImage || draggingImage.field !== field || draggingImage.url === targetUrl) {
      setDraggingImage(null)
      return
    }

    setDraft((current) => {
      const currentImages = current[field]
        .split('\n')
        .map((image) => image.trim())
        .filter(Boolean)
      const fromIndex = currentImages.indexOf(draggingImage.url)
      const toIndex = currentImages.indexOf(targetUrl)

      if (fromIndex < 0 || toIndex < 0) {
        return current
      }

      const nextImages = [...currentImages]
      const [movedImage] = nextImages.splice(fromIndex, 1)
      nextImages.splice(toIndex, 0, movedImage)

      return {
        ...current,
        [field]: nextImages.join('\n'),
      }
    })
    setDraggingImage(null)
    setStatusMessage('图片顺序已调整，请保存商品以写入数据库。')
  }

  async function handleRemoveImage(field: ImageListField, imageUrl: string, deleteFile: boolean) {
    const actionText = deleteFile ? '删除文件并移除引用' : '仅移除引用'
    const confirmed = window.confirm(`确认${actionText}？\n${imageUrl}`)

    if (!confirmed) {
      return
    }

    setErrorMessage('')
    setStatusMessage('')
    setDeletingImageUrl(imageUrl)

    try {
      if (deleteFile) {
        if (!isSupabaseConfigured()) {
          throw new Error('请先配置 Supabase 后再删除 Storage 文件。')
        }

        const deleted = await adminProductService.deleteProductImageFile(imageUrl)

        if (!deleted) {
          throw new Error('该图片不是 product-images bucket 的公开 URL，无法删除 Storage 文件。')
        }
      }

      setDraft((current) => {
        const nextImages = parseImageUrlText(current[field]).filter((item) => item !== imageUrl)

        return {
          ...current,
          [field]: nextImages.join('\n'),
        }
      })
      setStatusMessage(deleteFile ? '已删除图片文件并移除 URL，请保存商品以写入数据库。' : '已移除图片 URL，请保存商品以写入数据库。')
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error))
    } finally {
      setDeletingImageUrl('')
    }
  }

  return (
    <section className="page-stack">
      <PageHeader
        action={
          <button className="primary-button" onClick={startNewProduct} type="button">
            <Plus size={18} />
            {t('admin.addProduct')}
          </button>
        }
        description={t('admin.productsDescription')}
        title={t('admin.products')}
      />

      <div className="admin-kpi-grid">
        <article className="admin-card">
          <span className="admin-kpi-label">{t('admin.totalProducts')}</span>
          <strong>{products.length}</strong>
        </article>
        <article className="admin-card">
          <span className="admin-kpi-label">{t('admin.activeProducts')}</span>
          <strong>{activeCount}</strong>
        </article>
        <article className="admin-card">
          <span className="admin-kpi-label">{t('admin.featuredProducts')}</span>
          <strong>{featuredCount}</strong>
        </article>
      </div>

      <div className="admin-toolbar product-filter-toolbar">
        <div className="admin-search-combo">
          <select aria-label={t('admin.allCategories')} onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
            <option value="all">{t('admin.allCategories')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name[language]}
              </option>
            ))}
          </select>
          <select aria-label="上下架状态" onChange={(event) => setActiveStatus(event.target.value)} value={activeStatus}>
            <option value="all">全部状态</option>
            <option value="active">{t('admin.active')}</option>
            <option value="inactive">{t('admin.inactive')}</option>
          </select>
          <label className="search-field">
            <Search size={18} />
            <input onChange={(event) => setQuery(event.target.value)} placeholder="搜索商品" type="search" value={query} />
          </label>
          <label className="toggle-pill admin-featured-filter">
            <input checked={featuredOnly} onChange={(event) => setFeaturedOnly(event.target.checked)} type="checkbox" />
            <span>{t('admin.featured')}</span>
          </label>
        </div>
      </div>

      {errorMessage ? <div className="form-card error-panel"><p>{errorMessage}</p></div> : null}
      {statusMessage ? <div className="form-card success-panel"><p>{statusMessage}</p></div> : null}

      <div className="admin-management-grid">
        <div className="admin-list-panel">
          {filteredProducts.map((product) => (
            <button
              className={`admin-list-item ${product.id === selectedProductId ? 'selected' : ''}`}
              key={product.id}
              onClick={() => selectProduct(product)}
              type="button"
            >
              <span className="admin-thumb">{product.coverImage ? <img alt="" src={product.coverImage} /> : null}</span>
              <span>
                <strong>{product.name[language]}</strong>
                <small>{categoryNameById.get(product.categoryId) ?? t('admin.uncategorized')}</small>
              </span>
              <span className="admin-list-status">
                <span className={`admin-product-status ${product.isActive ? 'active' : 'inactive'}`}>
                  {product.isActive ? <CircleCheck size={13} /> : null}
                  {product.isActive ? t('admin.active') : t('admin.inactive')}
                </span>
                {product.isFeatured ? <Star className="status-icon" size={16} /> : null}
              </span>
            </button>
          ))}
        </div>

        <form className="form-card admin-edit-form" onSubmit={handleSave}>
          <div className="section-title-row">
            <div>
              <p className="eyebrow">{t('admin.productEditor')}</p>
              <h2>{selectedProduct ? selectedProduct.name[language] : t('admin.newProduct')}</h2>
            </div>
            <div className="editor-title-actions">
              <button className="secondary-button" disabled={autoFillingModule !== null} onClick={() => void handleAutoFillBasicField('name')} type="button">
                <Languages size={18} />
                {autoFillingModule === 'name' ? t('admin.autoFillingTranslations') : '补齐名称 EN/RU/UZ'}
              </button>
              <span className={`status-pill ${draft.isActive ? 'success' : 'muted'}`}>
                {draft.isActive ? t('admin.active') : t('admin.inactive')}
              </span>
            </div>
          </div>
          <p className="field-hint">{t('admin.autoFillTranslationsHint')}</p>
          <div className="form-grid language-columns">
            <label>
              {t('admin.nameZh')}
              <input onChange={(event) => updateDraft('nameZh', event.target.value)} required value={draft.nameZh} />
            </label>
            <label>
              {t('admin.nameEn')}
              <input onChange={(event) => updateDraft('nameEn', event.target.value)} value={draft.nameEn} />
            </label>
            <label>
              {t('admin.nameRu')}
              <input onChange={(event) => updateDraft('nameRu', event.target.value)} value={draft.nameRu} />
            </label>
            <label>
              {t('admin.nameUz')}
              <input onChange={(event) => updateDraft('nameUz', event.target.value)} value={draft.nameUz} />
            </label>
          </div>
          <div className="form-grid two-columns">
            <label>
              {t('admin.category')}
              <select onChange={(event) => updateDraft('categoryId', event.target.value)} value={draft.categoryId}>
                <option value="">{t('admin.uncategorized')}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name[language]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('admin.sortOrder')}
              <input onChange={(event) => updateDraft('sortOrder', event.target.value)} type="number" value={draft.sortOrder} />
            </label>
          </div>
          <div className="status-toggle-row">
            <label className="checkbox-label">
              {t('admin.active')}
              <input checked={draft.isActive} onChange={(event) => updateDraft('isActive', event.target.checked)} type="checkbox" />
            </label>
            <label className="checkbox-label">
              {t('admin.featured')}
              <input checked={draft.isFeatured} onChange={(event) => updateDraft('isFeatured', event.target.checked)} type="checkbox" />
            </label>
          </div>
          <div className="section-title-row inline-section-title">
            <div>
              <h3>商品简介</h3>
              <small className="field-hint">只补齐简介区域的英文、俄文和乌兹语字段。</small>
            </div>
            <button className="secondary-button" disabled={autoFillingModule !== null} onClick={() => void handleAutoFillBasicField('description')} type="button">
              <Languages size={18} />
              {autoFillingModule === 'description' ? t('admin.autoFillingTranslations') : '补齐简介 EN/RU/UZ'}
            </button>
          </div>
          <div className="form-grid language-columns">
            <label>
              {t('admin.descriptionZh')}
              <textarea onChange={(event) => updateDraft('descriptionZh', event.target.value)} rows={3} value={draft.descriptionZh} />
            </label>
            <label>
              {t('admin.descriptionEn')}
              <textarea onChange={(event) => updateDraft('descriptionEn', event.target.value)} rows={3} value={draft.descriptionEn} />
            </label>
            <label>
              {t('admin.descriptionRu')}
              <textarea onChange={(event) => updateDraft('descriptionRu', event.target.value)} rows={3} value={draft.descriptionRu} />
            </label>
            <label>
              {t('admin.descriptionUz')}
              <textarea onChange={(event) => updateDraft('descriptionUz', event.target.value)} rows={3} value={draft.descriptionUz} />
            </label>
          </div>
          <div className="form-grid two-columns">
            <label>
              {t('admin.tags')}
              <textarea onChange={(event) => updateDraft('tagsText', event.target.value)} rows={3} value={draft.tagsText} />
            </label>
          </div>
          <section className="spec-editor">
            <div className="section-title-row">
              <div>
                <h3>规格属性</h3>
                <small className="field-hint">用于前台详情购买卡展示，可新增或删除属性。</small>
              </div>
              <div className="section-actions">
                <button className="secondary-button" disabled={autoFillingModule !== null} onClick={() => void handleAutoFillSpecs()} type="button">
                  <Languages size={18} />
                  {autoFillingModule === 'specs' ? t('admin.autoFillingTranslations') : '补齐属性 EN/RU/UZ'}
                </button>
                <button className="secondary-button" onClick={addSpec} type="button">
                  <Plus size={18} />
                  新增属性
                </button>
              </div>
            </div>
            {draft.specs.length === 0 ? <p className="field-hint">暂无规格属性。</p> : null}
            <div className="spec-editor-list">
              {draft.specs.map((spec, index) => (
                <article className="spec-editor-item" key={spec.id}>
                  <div className="section-title-row">
                    <strong>属性 {index + 1}</strong>
                    <button className="danger-button compact-button" onClick={() => removeSpec(spec.id)} type="button">
                      <Trash2 size={16} />
                      删除
                    </button>
                  </div>
                  <div className="form-grid language-columns">
                    <label>
                      中文属性名
                      <input onChange={(event) => updateSpec(spec.id, 'labelZh', event.target.value)} value={spec.labelZh} />
                    </label>
                    <label>
                      英文属性名
                      <input onChange={(event) => updateSpec(spec.id, 'labelEn', event.target.value)} value={spec.labelEn} />
                    </label>
                    <label>
                      俄文属性名
                      <input onChange={(event) => updateSpec(spec.id, 'labelRu', event.target.value)} value={spec.labelRu} />
                    </label>
                    <label>
                      乌兹语属性名
                      <input onChange={(event) => updateSpec(spec.id, 'labelUz', event.target.value)} value={spec.labelUz} />
                    </label>
                  </div>
                  <div className="form-grid language-columns">
                    <label>
                      中文属性值
                      <input onChange={(event) => updateSpec(spec.id, 'valueZh', event.target.value)} value={spec.valueZh} />
                    </label>
                    <label>
                      英文属性值
                      <input onChange={(event) => updateSpec(spec.id, 'valueEn', event.target.value)} value={spec.valueEn} />
                    </label>
                    <label>
                      俄文属性值
                      <input onChange={(event) => updateSpec(spec.id, 'valueRu', event.target.value)} value={spec.valueRu} />
                    </label>
                    <label>
                      乌兹语属性值
                      <input onChange={(event) => updateSpec(spec.id, 'valueUz', event.target.value)} value={spec.valueUz} />
                    </label>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="spec-editor variant-editor">
            <div className="section-title-row">
              <div>
                <h3>销售规格</h3>
                <small className="field-hint">用于前台选择规格、购物车计价和订单快照；商品价格只从启用的销售规格中读取。</small>
              </div>
              <div className="section-actions">
                <button className="secondary-button" disabled={autoFillingModule !== null} onClick={() => void handleAutoFillVariants()} type="button">
                  <Languages size={18} />
                  {autoFillingModule === 'variants' ? t('admin.autoFillingTranslations') : '补齐规格 EN/RU/UZ'}
                </button>
                <button className="secondary-button" onClick={addVariant} type="button">
                  <Plus size={18} />
                  新增规格
                </button>
              </div>
            </div>
            {draft.variants.length === 0 ? <p className="field-hint">暂无销售规格，前台将显示询价且不能直接加入购物车。</p> : null}
            <div className="spec-editor-list">
              {draft.variants.map((variant, index) => (
                <article className="spec-editor-item" key={variant.id}>
                  <div className="section-title-row">
                    <strong>规格 {index + 1}</strong>
                    <button className="danger-button compact-button" onClick={() => removeVariant(variant.id)} type="button">
                      <Trash2 size={16} />
                      删除
                    </button>
                  </div>
                  <div className="form-grid language-columns">
                    <label>
                      中文规格名
                      <input onChange={(event) => updateVariant(variant.id, 'nameZh', event.target.value)} value={variant.nameZh} />
                    </label>
                    <label>
                      英文规格名
                      <input onChange={(event) => updateVariant(variant.id, 'nameEn', event.target.value)} value={variant.nameEn} />
                    </label>
                    <label>
                      俄文规格名
                      <input onChange={(event) => updateVariant(variant.id, 'nameRu', event.target.value)} value={variant.nameRu} />
                    </label>
                    <label>
                      乌兹语规格名
                      <input onChange={(event) => updateVariant(variant.id, 'nameUz', event.target.value)} value={variant.nameUz} />
                    </label>
                  </div>
                  <div className="form-grid language-columns">
                    <label>
                      价格
                      <input min="0" onChange={(event) => updateVariant(variant.id, 'price', event.target.value)} step="0.01" type="number" value={variant.price} />
                    </label>
                    <label>
                      SKU
                      <input onChange={(event) => updateVariant(variant.id, 'sku', event.target.value)} value={variant.sku} />
                    </label>
                    <label>
                      排序
                      <input onChange={(event) => updateVariant(variant.id, 'sortOrder', event.target.value)} type="number" value={variant.sortOrder} />
                    </label>
                  </div>
                  <div className="form-grid two-columns">
                    <label className="checkbox-label">
                      <span>启用</span>
                      <input checked={variant.isActive} onChange={(event) => updateVariant(variant.id, 'isActive', event.target.checked)} type="checkbox" />
                    </label>
                    <label className="checkbox-label">
                      <span>默认规格</span>
                      <input checked={variant.isDefault} onChange={(event) => updateVariant(variant.id, 'isDefault', event.target.checked)} type="checkbox" />
                    </label>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <div className="section-title-row inline-section-title">
            <div>
              <h3>商品详情</h3>
              <small className="field-hint">只补齐详情区域的英文、俄文和乌兹语字段。</small>
            </div>
            <button className="secondary-button" disabled={autoFillingModule !== null} onClick={() => void handleAutoFillBasicField('detail')} type="button">
              <Languages size={18} />
              {autoFillingModule === 'detail' ? t('admin.autoFillingTranslations') : '补齐详情 EN/RU/UZ'}
            </button>
          </div>
          <div className="form-grid language-columns">
            <label>
              {t('admin.detailZh')}
              <textarea onChange={(event) => updateDraft('detailZh', event.target.value)} rows={4} value={draft.detailZh} />
            </label>
            <label>
              {t('admin.detailEn')}
              <textarea onChange={(event) => updateDraft('detailEn', event.target.value)} rows={4} value={draft.detailEn} />
            </label>
            <label>
              {t('admin.detailRu')}
              <textarea onChange={(event) => updateDraft('detailRu', event.target.value)} rows={4} value={draft.detailRu} />
            </label>
            <label>
              {t('admin.detailUz')}
              <textarea onChange={(event) => updateDraft('detailUz', event.target.value)} rows={4} value={draft.detailUz} />
            </label>
          </div>
          <div className="form-grid">
            <label>
              {t('admin.coverImage')}
              <small className="field-hint">{t('admin.coverImageHint')}</small>
              <div className="field-with-button wide-field-with-button image-url-field">
                <textarea readOnly rows={4} title="URL 列表只读，请通过下方缩略图移除引用或删除文件" value={draft.coverImagesText} />
                <button className="secondary-button" disabled={isUploadingCoverImage} onClick={() => coverImageInputRef.current?.click()} type="button">
                  <ImagePlus size={18} />
                  {isUploadingCoverImage ? '上传中...' : '上传'}
                </button>
              </div>
              {coverImageUrls.length > 0 ? (
                <div className="image-manager-grid">
                  {coverImageUrls.map((imageUrl, index) => {
                    const isDeleting = deletingImageUrl === imageUrl
                    const canDeleteFile = canDeleteStorageImage(imageUrl)

                    return (
                      <article
                        className={`image-manager-item${draggingImage?.field === 'coverImagesText' && draggingImage.url === imageUrl ? ' is-dragging' : ''}`}
                        draggable
                        key={`${imageUrl}-${index}`}
                        onDragEnd={() => setDraggingImage(null)}
                        onDragOver={(event) => handleImageDragOver(event, 'coverImagesText')}
                        onDragStart={(event) => handleImageDragStart(event, 'coverImagesText', imageUrl)}
                        onDrop={(event) => handleImageDrop(event, 'coverImagesText', imageUrl)}
                        title="拖动缩略图可调整顺序"
                      >
                        <div className="image-manager-preview">
                          <img alt={`主图 ${index + 1}`} src={imageUrl} />
                          {index === 0 ? <span className="image-manager-badge">首图</span> : null}
                        </div>
                        <p title={imageUrl}>{imageUrl}</p>
                        <div className="image-manager-actions">
                          {canDeleteFile ? (
                            <button
                              className="danger-button compact-button"
                              disabled={isDeleting}
                              onClick={() => void handleRemoveImage('coverImagesText', imageUrl, true)}
                              title="删除 Supabase Storage 文件并移除 URL"
                              type="button"
                            >
                              {isDeleting ? '删除中...' : '删除文件'}
                            </button>
                          ) : (
                            <button className="secondary-button compact-button" disabled={isDeleting} onClick={() => void handleRemoveImage('coverImagesText', imageUrl, false)} type="button">
                              移除引用
                            </button>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              ) : null}
            </label>
          </div>
          <input
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            multiple
            onChange={(event) => void handleCoverImageUpload(event)}
            ref={coverImageInputRef}
            type="file"
          />
          <label>
            {t('admin.images')}
            <small className="field-hint">{t('admin.imagesHint')}</small>
            <div className="field-with-button wide-field-with-button image-url-field">
              <textarea readOnly rows={4} title="URL 列表只读，请通过下方缩略图移除引用或删除文件" value={draft.imagesText} />
              <button className="secondary-button" disabled={isUploadingImages} onClick={() => imageInputRef.current?.click()} type="button">
                <ImagePlus size={18} />
                {isUploadingImages ? '上传中...' : t('admin.manageImages')}
              </button>
            </div>
            {detailImageUrls.length > 0 ? (
              <div className="image-manager-grid detail-image-manager-grid">
                {detailImageUrls.map((imageUrl, index) => {
                  const isDeleting = deletingImageUrl === imageUrl
                  const canDeleteFile = canDeleteStorageImage(imageUrl)

                  return (
                    <article
                      className={`image-manager-item${draggingImage?.field === 'imagesText' && draggingImage.url === imageUrl ? ' is-dragging' : ''}`}
                      draggable
                      key={`${imageUrl}-${index}`}
                      onDragEnd={() => setDraggingImage(null)}
                      onDragOver={(event) => handleImageDragOver(event, 'imagesText')}
                      onDragStart={(event) => handleImageDragStart(event, 'imagesText', imageUrl)}
                      onDrop={(event) => handleImageDrop(event, 'imagesText', imageUrl)}
                      title="拖动缩略图可调整顺序"
                    >
                      <div className="image-manager-preview">
                        <img alt={`详情图 ${index + 1}`} src={imageUrl} />
                      </div>
                      <p title={imageUrl}>{imageUrl}</p>
                      <div className="image-manager-actions">
                        {canDeleteFile ? (
                          <button
                            className="danger-button compact-button"
                            disabled={isDeleting}
                            onClick={() => void handleRemoveImage('imagesText', imageUrl, true)}
                            title="删除 Supabase Storage 文件并移除 URL"
                            type="button"
                          >
                            {isDeleting ? '删除中...' : '删除文件'}
                          </button>
                        ) : (
                          <button className="secondary-button compact-button" disabled={isDeleting} onClick={() => void handleRemoveImage('imagesText', imageUrl, false)} type="button">
                            移除引用
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : null}
          </label>
          <div className="admin-action-row">
            <input
              accept="image/jpeg,image/png,image/webp,image/gif"
              hidden
              multiple
              onChange={(event) => void handleImageUpload(event)}
              ref={imageInputRef}
              type="file"
            />
            <button className="primary-button" disabled={isSaving} type="submit">
              <Save size={18} />
              {isSaving ? t('admin.saving') : t('common.save')}
            </button>
            <button className="danger-button" disabled={!selectedProduct} onClick={() => void handleDelete()} type="button">
              <Trash2 size={18} />
              删除商品
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
