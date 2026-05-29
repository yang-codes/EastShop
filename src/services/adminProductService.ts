import { getSupabaseClient } from '../lib/supabaseClient'
import type { Product } from '../types/product'

export const adminProductService = {
  async listProducts(): Promise<Product[]> {
    const { data, error } = await getSupabaseClient().from('products').select('*').order('sort_order')

    if (error) {
      throw error
    }

    return data as Product[]
  },

  async setProductActive(productId: string, isActive: boolean) {
    const { error } = await getSupabaseClient()
      .from('products')
      .update({ is_active: isActive })
      .eq('id', productId)

    if (error) {
      throw error
    }
  },
}
