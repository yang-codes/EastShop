import { getSupabaseClient } from '../lib/supabaseClient'
import type { AdminProfile } from '../types/admin'

type AdminProfileRow = {
  user_id: string
  email: string
  display_name: string
  role: 'admin'
  is_active: boolean
}

function mapAdminProfile(row: AdminProfileRow): AdminProfile {
  return {
    displayName: row.display_name,
    email: row.email,
    isActive: row.is_active,
    role: row.role,
    userId: row.user_id,
  }
}

export const authService = {
  /**
   * 读取当前 Supabase Auth 用户对应的启用管理员档案。
   * 业务用途：保护后台路由，只有 admin_profiles 中启用的账号才能进入管理后台。
   * 返回 null 表示未登录或没有后台权限。
   */
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

    return data ? mapAdminProfile(data as AdminProfileRow) : null
  },

  /**
   * 使用 Supabase 邮箱密码登录管理员账号。
   * 业务用途：后台不开放注册，只允许已在 Supabase Auth 和 admin_profiles 中授权的运营账号登录。
   */
  async signIn(email: string, password: string) {
    return getSupabaseClient().auth.signInWithPassword({ email, password })
  },

  /**
   * 结束当前 Supabase Auth 会话。
   * 业务用途：管理员退出后台，清除当前登录状态并返回登录页。
   */
  async signOut() {
    return getSupabaseClient().auth.signOut()
  },
}
