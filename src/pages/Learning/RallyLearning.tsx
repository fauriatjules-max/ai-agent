import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../../store/useStore'
import Simulator3D from '../../components/Simulator/Simulator3D'
import LessonSidebar from '../../components/Learning/LessonSidebar'
import QuizComponent from '../../components/Learning/QuizComponent'
import { 
  Play, 
  Pause, 
  SkipForward, 
  Rewind,
  CheckCircle,
  AlertTriangle,
  Target,
  Timer
} from 'lucide-react'

const rallyLessons = [
  {
    id: 'rally-1',
    title: 'Introduction au Rallye',
    type: 'theory',
    duration: 10,
    content: {
      text: `Le rallye est une discipline automobile se déroulant sur route ouverte, 
             avec des surfaces variées (terre, asphalte, neige). Maîtriser le contrôle 
             de la voiture en glisse est essentiel.`,
      videos: ['/videos/rally-intro.mp4']
    }
  },
  {
    id: 'rally-2',
    title: 'Le Contre-braquage',
    type: 'simulation',
    duration: 15,
    content: {
      simulationParams: {
        trackId: 'monte-carlo',
        carModel: 'subaru-impreza',
        weather: 'clear',
        challenges: [
          {
            type: 'cornering',
            targetValue: 45,
            tolerance: 5,
            instructions: 'Effectuez un contre-braquage à 45° dans le virage suivant'
          }
        ]
      }
    }
  }
]

export default function RallyLearning() {
  const { currentLesson, completeLesson, updateSimulationStats } = useStore()
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(300) // 5 minutes
  const [score, setScore] = useState(100)
  const [mistakes, setMistakes] = useState<Array<{type: string, time: number}>>([])

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isPlaying && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining(prev => prev - 1)
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [isPlaying, timeRemaining])

  const handleComplete = () => {
    const finalScore = Math.max(0, score - mistakes.length * 10)
    completeLesson(currentLesson?.id || '', finalScore)
  }

  const handleMistake = (type: string) => {
    setMistakes(prev => [...prev, { type, time: timeRemaining }])
    setScore(prev => Math.max(0, prev - 10))
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 to-black text-white">
      {/* Sidebar des leçons */}
      <LessonSidebar 
        lessons={rallyLessons}
        currentLessonId={currentLesson?.id}
      />

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">{currentLesson?.title}</h1>
            <p className="text-gray-400">Rallye • Niveau Intermédiaire</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-500">{score}</div>
              <div className="text-sm text-gray-400">Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">
                {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
              </div>
              <div className="text-sm text-gray-400">Temps restant</div>
            </div>
          </div>
        </div>

        {/* Zone de contenu */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Zone de simulation/lecture */}
          <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4">
            <div className="h-full flex flex-col">
              <div className="flex-1">
                {currentLesson?.type === 'simulation' ? (
                  <Simulator3D
                    trackId="monte-carlo"
                    carModel="subaru-impreza"
                    weather="clear"
                    timeOfDay="day"
                    onStatsUpdate={updateSimulationStats}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <video
                        className="rounded-lg mb-4"
                        controls
                        src="/videos/rally-intro.mp4"
                      />
                      <p className="text-gray-300 max-w-2xl">
                        {currentLesson?.content?.text}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Contrôles */}
              <div className="mt-4 flex items-center justify-center space-x-4">
                <button className="p-3 rounded-full bg-gray-700 hover:bg-gray-600">
                  <Rewind className="w-6 h-6" />
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-4 rounded-full bg-red-600 hover:bg-red-500"
                >
                  {isPlaying ? (
                    <Pause className="w-8 h-8" />
                  ) : (
                    <Play className="w-8 h-8" />
                  )}
                </button>
                <button className="p-3 rounded-full bg-gray-700 hover:bg-gray-600">
                  <SkipForward className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Panneau d'instructions et feedback */}
          <div className="space-y-6">
            {/* Objectifs */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <Target className="w-6 h-6 mr-2 text-red-500" />
                Objectifs de la leçon
              </h3>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                  Maîtriser le contre-braquage à 45°
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                  Maintenir une vitesse constante dans les virages
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-yellow-500 mr-2" />
                  Réduire les erreurs de trajectoire
                </li>
              </ul>
            </div>

            {/* Feedback en temps réel */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <AlertTriangle className="w-6 h-6 mr-2 text-yellow-500" />
                Feedback en direct
              </h3>
              <div className="space-y-3">
                {mistakes.slice(-3).map((mistake, index) => (
                  <div
                    key={index}
                    className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg"
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">Erreur: {mistake.type}</span>
                      <span className="text-sm text-gray-400">
                        -{300 - mistake.time}s
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mt-1">
                      Correction: Réduisez l'angle de braquage
                    </p>
                  </div>
                ))}
                {mistakes.length === 0 && (
                  <p className="text-gray-400 text-center py-4">
                    Aucune erreur pour le moment. Continuez comme ça !
                  </p>
                )}
              </div>
            </div>

            {/* Statistiques */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
              <h3 className="text-xl font-semibold mb-4">Statistiques</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                  <div className="text-2xl font-bold text-green-500">98%</div>
                  <div className="text-sm text-gray-400">Précision</div>
                </div>
                <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-500">0.4s</div>
                  <div className="text-sm text-gray-400">Réaction</div>
                </div>
                <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-500">3</div>
                  <div className="text-sm text-gray-400">Erreurs</div>
                </div>
                <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-500">85</div>
                  <div className="text-sm text-gray-400">Km/h moyen</div>
                </div>
              </div>
            </div>

            {/* Bouton de complétion */}
            <button
              onClick={handleComplete}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity"
            >
              ✓ Terminer la leçon
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
