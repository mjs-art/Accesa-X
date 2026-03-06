import type { AuthUser, UserRole } from '../types/auth.types'

export interface IAuthRepository {
  getUser(): Promise<AuthUser | null>
  getUserRole(userId: string): Promise<UserRole>
  signOut(): Promise<void>
}
