import type { IAuthRepository } from '../repositories/auth.repository'
import type { AuthUser, UserRole } from '../types/auth.types'

export class AuthService {
  constructor(private readonly authRepo: IAuthRepository) {}

  async getUser(): Promise<AuthUser | null> {
    return this.authRepo.getUser()
  }

  async getUserRole(userId: string): Promise<UserRole> {
    return this.authRepo.getUserRole(userId)
  }

  async signOut(): Promise<void> {
    return this.authRepo.signOut()
  }

  async requireUser(): Promise<AuthUser> {
    const user = await this.authRepo.getUser()
    if (!user) throw new Error('UNAUTHENTICATED')
    return user
  }
}
