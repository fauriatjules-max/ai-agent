import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  user: any | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  loginWithGithub: () => Promise<void>
  register: (userData: any) => Promise<void>
  logout: () => void
  updateProfile: (data: any) => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

// Mock pour le développement - remplacer par une vraie API
const mockAuthAPI = {
  login: async (email: string, password: string) => {
    await new Promise(resolve => setTimeout(resolve, 1000))
    if (email && password) {
      return {
        user: {
          id: 'user_' + Date.now(),
          email,
          username: email.split('@')[0],
          level: 1,
          xp: 0,
          streak: 0,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`
        },
        token: 'mock_jwt_token_' + Date.now()
      }
    }
    throw new Error('Invalid credentials')
  },
  
  register: async (userData: any) => {
    await new Promise(resolve => setTimeout(resolve, 1000))
    return {
      user: {
        id: 'user_' + Date.now(),
        ...userData,
        level: 1,
        xp: 0,
        streak: 0
      },
      token: 'mock_jwt_token_' + Date.now()
    }
  }
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      
      login: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          const response = await mockAuthAPI.login(email, password)
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false
          })
          localStorage.setItem('auth_token', response.token)
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },
      
      loginWithGoogle: async () => {
        set({ isLoading: true })
        try {
          // Implémenter OAuth Google
          const googleUser = await new Promise<any>(resolve => {
            // Simulation
            setTimeout(() => resolve({
              id: 'google_' + Date.now(),
              email: 'user@gmail.com',
              name: 'Google User',
              picture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=google'
            }), 1000)
          })
          
          set({
            user: {
              id: googleUser.id,
              email: googleUser.email,
              username: googleUser.name,
              avatar: googleUser.picture,
              level: 1,
              xp: 0,
              streak: 0
            },
            token: 'google_token_' + Date.now(),
            isAuthenticated: true,
            isLoading: false
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },
      
      loginWithGithub: async () => {
        set({ isLoading: true })
        // Similaire à Google
        set({ isLoading: false })
      },
      
      register: async (userData: any) => {
        set({ isLoading: true })
        try {
          const response = await mockAuthAPI.register(userData)
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false
          })
          localStorage.setItem('auth_token', response.token)
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },
      
      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false
        })
        localStorage.removeItem('auth_token')
        localStorage.removeItem('duolingo-pilotage-store')
      },
      
      updateProfile: async (data: any) => {
        const { user } = get()
        if (!user) throw new Error('Not authenticated')
        
        set({
          user: { ...user, ...data }
        })
        
        // Ici, appeler l'API pour mettre à jour en backend
        await new Promise(resolve => setTimeout(resolve, 500))
      },
      
      resetPassword: async (email: string) => {
        set({ isLoading: true })
        // Implémenter la réinitialisation
        await new Promise(resolve => setTimeout(resolve, 1000))
        set({ isLoading: false })
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)
