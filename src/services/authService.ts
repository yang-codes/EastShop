import { getSupabaseClient } from '../lib/supabaseClient'
import type { AdminProfile } from '../types/admin'

export const authService = {
  async getCurrentAdmin(): Promise<AdminProfile | null> {
    const {
      data: { user },
    } = await getSupabaseClient().auth.getUser()

    if (!user) {
      return null
    }

    const { data, error } = await getSupabaseClient()
      .from('admin_profiles')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      throw error
    }

    return data as AdminProfile | null
  },

  async signIn(email: string, password: string) {
    return getSupabaseClient().auth.signInWithPassword({ email, password })
  },

  async signOut() {
    return getSupabaseClient().auth.signOut()
  },
}
