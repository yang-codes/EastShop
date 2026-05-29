import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient'
import type { Category, Product } from '../types/product'

async function loadMockData<T>(fileName: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}mock/${fileName}`)

  if (!response.ok) {
    throw new Error(`Failed to load mock data: ${fileName}`)
  }

  return response.json() as Promise<T>
}

export const catalogService = {
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

    return data as Product | null
  },

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

    return data as Category[]
  },

  async listActiveProducts(): Promise<Product[]> {
    if (!isSupabaseConfigured()) {
      return loadMockData<Product[]>('products.json')
    }

    const { data, error } = await getSupabaseClient()
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')

    if (error) {
      throw error
    }

    return data as Product[]
  },
}
