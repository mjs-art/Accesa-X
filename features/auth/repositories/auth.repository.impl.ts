import type { SupabaseClient } from '@supabase/supabase-js'
import type { IAuthRepository } from './auth.repository'
import type { AuthUser, UserRole } from '../types/auth.types'

export class SupabaseAuthRepository implements IAuthRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getUser(): Promise<AuthUser | null> {
    const { data: { user }, error } = await this.supabase.auth.getUser()
    if (error || !user) return null

    const role = await this.getUserRole(user.id)
    return { id: user.id, email: user.email ?? '', role }
  }

  async getUserRole(userId: string): Promise<UserRole> {
    const { data } = await this.supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    return (data?.role as UserRole) ?? 'user'
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut()
  }
}
