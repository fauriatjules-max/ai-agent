import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { User, Category, Lesson, Progress, Track } from '../shared/types'

interface AppState {
  // État utilisateur
  user: User | null
  isAuthenticated: boolean
  selectedCategory: Category | null
  currentLesson: Lesson | null
  progress: Progress[]
  
  // État simulation
  isSimulationRunning: boolean
  simulationSpeed: number
  currentTrack: Track | null
  simulationStats: {
    lapTime: number
    topSpeed: number
    accuracy: number
    mistakes: number
  }
  
  // UI State
  isLoading: boolean
  isInitialized: boolean
  theme: 'light' | 'dark'
  language: string
  
  // Actions
  setUser: (user: User | null) => void
  selectCategory: (category: Category) => void
  startLesson: (lesson: Lesson) => void
  completeLesson: (lessonId: string, score: number) => void
  updateProgress: (progress: Progress) => void
  startSimulation: (track: Track) => void
  stopSimulation: () => void
  updateSimulationStats: (stats: Partial<AppState['simulationStats']>) => void
  setTheme: (theme: 'light' | 'dark') => void
  setLanguage: (language: string) => void
  initializeApp: () => Promise<void>
  resetProgress: () => void
}

export const useStore = create<AppState>()(
  persist(
    immer((set) => ({
      // État initial
      user: null,
      isAuthenticated: false,
      selectedCategory: null,
      currentLesson: null,
      progress: [],
      isSimulationRunning: false,
      simulationSpeed: 1,
      currentTrack: null,
      simulationStats: {
        lapTime: 0,
        topSpeed: 0,
        accuracy: 100,
        mistakes: 0
      },
      isLoading: false,
      isInitialized: false,
      theme: 'dark',
      language: 'fr',
      
      // Actions
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      
      selectCategory: (category) => 
        set((state) => {
          state.selectedCategory = category
          state.currentLesson = category.lessons[0]
        }),
      
      startLesson: (lesson) => 
        set({ currentLesson: lesson, isSimulationRunning: true }),
      
      completeLesson: (lessonId, score) =>
        set((state) => {
          const existingProgress = state.progress.find(p => p.lessonId === lessonId)
          if (existingProgress) {
            existingProgress.score = Math.max(existingProgress.score, score)
            existingProgress.completedAt = new Date().toISOString()
            existingProgress.attempts += 1
          } else {
            state.progress.push({
              id: crypto.randomUUID(),
              userId: state.user?.id || 'anonymous',
              lessonId,
              score,
              completedAt: new Date().toISOString(),
              attempts: 1
            })
          }
          state.isSimulationRunning = false
        }),
      
      updateProgress: (progress) =>
        set((state) => {
          const index = state.progress.findIndex(p => p.id === progress.id)
          if (index >= 0) {
            state.progress[index] = progress
          } else {
            state.progress.push(progress)
          }
        }),
      
      startSimulation: (track) =>
        set({ 
          isSimulationRunning: true, 
          currentTrack: track,
          simulationStats: {
            lapTime: 0,
            topSpeed: 0,
            accuracy: 100,
            mistakes: 0
          }
        }),
      
      stopSimulation: () =>
        set({ isSimulationRunning: false }),
      
      updateSimulationStats: (stats) =>
        set((state) => {
          state.simulationStats = { ...state.simulationStats, ...stats }
        }),
      
      setTheme: (theme) =>
        set({ theme }),
      
      setLanguage: (language) =>
        set({ language }),
      
      initializeApp: async () => {
        set({ isLoading: true })
        
        try {
          // Charger les données initiales
          const [categories, savedProgress] = await Promise.all([
            fetch('/data/categories.json').then(r => r.json()),
            localStorage.getItem('user-progress') 
              ? JSON.parse(localStorage.getItem('user-progress')!)
              : []
          ])
          
          // Récupérer le thème sauvegardé
          const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'dark'
          
          set({
            progress: savedProgress,
            theme: savedTheme,
            isInitialized: true,
            isLoading: false
          })
          
          // Appliquer le thème
          document.documentElement.classList.toggle('dark', savedTheme === 'dark')
          
        } catch (error) {
          console.error('Erreur initialisation:', error)
          set({ isLoading: false })
        }
      },
      
      resetProgress: () =>
        set((state) => {
          state.progress = []
          state.currentLesson = null
          state.selectedCategory = null
          localStorage.removeItem('user-progress')
        })
    })),
    {
      name: 'duolingo-pilotage-store',
      partialize: (state) => ({
        user: state.user,
        progress: state.progress,
        theme: state.theme,
        language: state.language
      })
    }
  )
)
