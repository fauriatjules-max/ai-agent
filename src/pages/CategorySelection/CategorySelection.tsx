import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { 
  Car, 
  Trophy, 
  Flag, 
  Mountain, 
  Zap, 
  Shield,
  Lock,
  ChevronRight,
  Star
} from 'lucide-react'
import type { Category } from '../../shared/types'

const categories: Category[] = [
  {
    id: 'rally',
    name: 'Rallye',
    icon: 'Mountain',
    color: 'from-orange-500 to-red-600',
    description: 'Maîtrisez les techniques de pilotage sur terre, neige et gravier',
    difficulty: 'intermediate',
    lessons: [],
    unlocked: true
  },
  {
    id: 'formula',
    name: 'Formule 1',
    icon: 'Car',
    color: 'from-red-600 to-rose-700',
    description: 'Perfectionnez votre pilotage sur circuit à haute vitesse',
    difficulty: 'advanced',
    lessons: [],
    unlocked: true
  },
  {
    id: 'endurance',
    name: 'Endurance',
    icon: 'Flag',
    color: 'from-blue-500 to-cyan-600',
    description: 'Apprenez la gestion de course et la stratégie sur longue distance',
    difficulty: 'intermediate',
    lessons: [],
    unlocked: true
  },
  {
    id: 'drift',
    name: 'Drift',
    icon: 'Zap',
    color: 'from-purple-600 to-pink-600',
    description: 'Contrôlez les dérapages et maîtrisez les virages en glisse',
    difficulty: 'advanced',
    lessons: [],
    unlocked: false
  },
  {
    id: 'karting',
    name: 'Karting',
    icon: 'Car',
    color: 'from-green-500 to-emerald-600',
    description: 'Bases du pilotage et techniques de virage',
    difficulty: 'beginner',
    lessons: [],
    unlocked: true
  },
  {
    id: 'street',
    name: 'Course Urbaine',
    icon: 'Shield',
    color: 'from-gray-600 to-gray-800',
    description: 'Pilotage en environnement urbain et contraintes de route',
    difficulty: 'expert',
    lessons: [],
    unlocked: false
  }
]

const CategorySelection = () => {
  const navigate = useNavigate()
  const { selectCategory, progress } = useStore()
  const [selected, setSelected] = useState<Category | null>(null)

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Car': return <Car className="w-8 h-8" />
      case 'Trophy': return <Trophy className="w-8 h-8" />
      case 'Flag': return <Flag className="w-8 h-8" />
      case 'Mountain': return <Mountain className="w-8 h-8" />
      case 'Zap': return <Zap className="w-8 h-8" />
      case 'Shield': return <Shield className="w-8 h-8" />
      default: return <Car className="w-8 h-8" />
    }
  }

  const getProgress = (categoryId: string) => {
    const categoryLessons = categories.find(c => c.id === categoryId)?.lessons || []
    const completed = progress.filter(p => 
      categoryLessons.some(l => l.id === p.lessonId)
    ).length
    return categoryLessons.length > 0 
      ? Math.round((completed / categoryLessons.length) * 100)
      : 0
  }

  const handleSelectCategory = (category: Category) => {
    if (!category.unlocked) return
    
    selectCategory(category)
    navigate(`/learn/${category.id}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-racing mb-4 bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
            CHOISISSEZ VOTRE DISCIPLINE
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Sélectionnez une catégorie pour commencer votre apprentissage. 
            Débloquez de nouvelles disciplines en progressant.
          </p>
        </motion.div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {categories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: category.unlocked ? 1.05 : 1 }}
                whileTap={{ scale: category.unlocked ? 0.95 : 1 }}
                className={`relative rounded-2xl overflow-hidden border-2 ${
                  category.unlocked 
                    ? 'border-gray-700 hover:border-red-500 cursor-pointer'
                    : 'border-gray-800 cursor-not-allowed'
                } bg-gradient-to-br from-gray-800 to-gray-900`}
                onClick={() => handleSelectCategory(category)}
              >
                {/* Lock overlay for locked categories */}
                {!category.unlocked && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-10 flex items-center justify-center">
                    <div className="text-center">
                      <Lock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-xl font-semibold">Catégorie verrouillée</p>
                      <p className="text-gray-400">Terminez les catégories précédentes</p>
                    </div>
                  </div>
                )}

                {/* Category Header */}
                <div className={`p-6 bg-gradient-to-r ${category.color}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                        {getIcon(category.icon)}
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">{category.name}</h3>
                        <div className="flex items-center space-x-2">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-4 h-4 ${
                                  star <= 
                                  (category.difficulty === 'beginner' ? 1 :
                                   category.difficulty === 'intermediate' ? 2 :
                                   category.difficulty === 'advanced' ? 3 : 4)
                                    ? 'fill-yellow-500 text-yellow-500'
                                    : 'text-gray-400'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm capitalize">{category.difficulty}</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6" />
                  </div>
                </div>

                {/* Category Body */}
                <div className="p-6">
                  <p className="text-gray-300 mb-6">{category.description}</p>
                  
                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Progression</span>
                      <span>{getProgress(category.id)}%</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${getProgress(category.id)}%` }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className={`h-full bg-gradient-to-r ${category.color} rounded-full`}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold">10+</div>
                      <div className="text-xs text-gray-400">Leçons</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">5</div>
                      <div className="text-xs text-gray-400">Circuits</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">500</div>
                      <div className="text-xs text-gray-400">XP max</div>
                    </div>
                  </div>
                </div>

                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* User Progress Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 p-6 bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700"
        >
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold mb-2">Votre progression globale</h3>
              <p className="text-gray-400">
                {progress.length} leçons terminées • {progress.reduce((acc, p) => acc + p.score, 0)} XP
              </p>
            </div>
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
              <div className="text-center">
                <div className="text-3xl font-bold text-red-500">
                  {Math.round((progress.length / 50) * 100)}%
                </div>
                <div className="text-sm text-gray-400">Complétion</div>
              </div>
              <button
                onClick={() => navigate('/progress')}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 rounded-lg font-semibold hover:opacity-90 transition-opacity"
              >
                Voir le détail
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default CategorySelection
