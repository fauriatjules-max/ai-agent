import { useState, useEffect } from 'react'
import { 
  TrendingUp, 
  Trophy, 
  Calendar, 
  Target,
  Award,
  BarChart3,
  Clock,
  Flame
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

export default function ProgressDashboard() {
  const { progress, user } = useStore()
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week')
  const [stats, setStats] = useState({
    totalXP: 0,
    averageScore: 0,
    lessonsCompleted: 0,
    streak: 0,
    timeSpent: 0,
    accuracy: 0,
    level: 1
  })

  useEffect(() => {
    // Calculer les statistiques
    const totalXP = progress.reduce((sum, p) => sum + p.score, 0)
    const averageScore = progress.length > 0 
      ? totalXP / progress.length 
      : 0
    const accuracy = progress.length > 0
      ? (progress.filter(p => p.score >= 70).length / progress.length) * 100
      : 0

    setStats({
      totalXP,
      averageScore,
      lessonsCompleted: progress.length,
      streak: user?.streak || 0,
      timeSpent: progress.length * 15, // estimation
      accuracy,
      level: Math.floor(totalXP / 1000) + 1
    })
  }, [progress, user])

  // Données pour les graphiques
  const lineData = {
    labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    datasets: [
      {
        label: 'XP gagnés',
        data: [65, 59, 80, 81, 56, 55, 40],
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.5)',
        tension: 0.4
      }
    ]
  }

  const barData = {
    labels: ['Rallye', 'Formule 1', 'Endurance', 'Drift', 'Karting'],
    datasets: [
      {
        label: 'Leçons complétées',
        data: [12, 19, 3, 5, 2],
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(245, 158, 11, 0.8)'
        ]
      }
    ]
  }

  const doughnutData = {
    labels: ['Théorie', 'Pratique', 'Simulation', 'Quiz'],
    datasets: [
      {
        data: [30, 25, 35, 10],
        backgroundColor: [
          'rgb(59, 130, 246)',
          'rgb(16, 185, 129)',
          'rgb(239, 68, 68)',
          'rgb(245, 158, 11)'
        ],
        borderWidth: 2,
        borderColor: '#1f2937'
      }
    ]
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-racing mb-2">TABLEAU DE BORD</h1>
          <p className="text-gray-400">Suivez votre progression et vos performances</p>
        </div>

        {/* Statistiques principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-red-900/30 to-red-800/20 rounded-2xl p-6 border border-red-800/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">XP TOTAL</p>
                <p className="text-3xl font-bold">{stats.totalXP}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-red-500" />
            </div>
            <div className="mt-4 h-2 bg-red-900/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full"
                style={{ width: `${Math.min(100, (stats.totalXP % 1000) / 10)}%` }}
              />
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-2xl p-6 border border-blue-800/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">SÉRIE ACTUELLE</p>
                <p className="text-3xl font-bold">{stats.streak} jours</p>
              </div>
              <Flame className="w-12 h-12 text-orange-500" />
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Continuez demain pour {stats.streak + 1} jours !
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-2xl p-6 border border-green-800/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">PRÉCISION MOYENNE</p>
                <p className="text-3xl font-bold">{stats.accuracy.toFixed(1)}%</p>
              </div>
              <Target className="w-12 h-12 text-green-500" />
            </div>
            <p className="text-sm text-gray-400 mt-2">
              {stats.accuracy > 80 ? 'Excellent !' : 'Peut mieux faire'}
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-2xl p-6 border border-purple-800/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">NIVEAU ACTUEL</p>
                <p className="text-3xl font-bold">{stats.level}</p>
              </div>
              <Trophy className="w-12 h-12 text-yellow-500" />
            </div>
            <p className="text-sm text-gray-400 mt-2">
              {1000 - (stats.totalXP % 1000)} XP pour le niveau {stats.level + 1}
            </p>
          </div>
        </div>

        {/* Graphiques */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Progression temporelle */}
          <div className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold flex items-center">
                <TrendingUp className="w-6 h-6 mr-2 text-red-500" />
                Progression hebdomadaire
              </h3>
              <select 
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1 text-sm"
              >
                <option value="week">7 jours</option>
                <option value="month">30 jours</option>
                <option value="year">1 an</option>
              </select>
            </div>
            <div className="h-64">
              <Line 
                data={lineData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      labels: { color: '#9ca3af' }
                    }
                  },
                  scales: {
                    x: {
                      grid: { color: '#374151' },
                      ticks: { color: '#9ca3af' }
                    },
                    y: {
                      grid: { color: '#374151' },
                      ticks: { color: '#9ca3af' }
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Répartition par catégorie */}
          <div className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700">
            <h3 className="text-xl font-semibold mb-6 flex items-center">
              <BarChart3 className="w-6 h-6 mr-2 text-blue-500" />
              Performance par discipline
            </h3>
            <div className="h-64">
              <Bar 
                data={barData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      labels: { color: '#9ca3af' }
                    }
                  },
                  scales: {
                    x: {
                      grid: { color: '#374151' },
                      ticks: { color: '#9ca3af' }
                    },
                    y: {
                      grid: { color: '#374151' },
                      ticks: { color: '#9ca3af' }
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Types d'activités */}
          <div className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700">
            <h3 className="text-xl font-semibold mb-6 flex items-center">
              <Clock className="w-6 h-6 mr-2 text-green-500" />
              Répartition des activités
            </h3>
            <div className="h-64 flex items-center justify-center">
              <div className="w-48 h-48">
                <Doughnut 
                  data={doughnutData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: { color: '#9ca3af' }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Derniers accomplissements */}
          <div className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700">
            <h3 className="text-xl font-semibold mb-6 flex items-center">
              <Award className="w-6 h-6 mr-2 text-yellow-500" />
              Accomplissements récents
            </h3>
            <div className="space-y-4">
              {[
                { title: 'Premier tour', desc: 'Complété votre premier tour', xp: 100 },
                { title: 'Contre-braquage maîtrisé', desc: 'Score parfait en rallye', xp: 250 },
                { title: 'Série de 7 jours', desc: 'Connecté 7 jours consécutifs', xp: 500 },
                { title: 'Expert F1', desc: 'Toutes les leçons Formule 1 terminées', xp: 1000 }
              ].map((achievement, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-lg flex items-center justify-center mr-3">
                      <Trophy className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-medium">{achievement.title}</p>
                      <p className="text-sm text-gray-400">{achievement.desc}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-yellow-500">+{achievement.xp} XP</p>
                    <p className="text-xs text-gray-400">Hier</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Objectifs quotidiens */}
        <div className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700">
          <h3 className="text-xl font-semibold mb-6 flex items-center">
            <Calendar className="w-6 h-6 mr-2 text-purple-500" />
            Objectifs du jour
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: 'Compléter 3 leçons', progress: 2, total: 3, reward: 150 },
              { title: 'Pratiquer 30 minutes', progress: 15, total: 30, reward: 200 },
              { title: 'Améliorer un record', progress: 0, total: 1, reward: 300 }
            ].map((goal, index) => (
              <div key={index} className="bg-gray-900/50 rounded-xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-medium">{goal.title}</span>
                  <span className="text-yellow-500 font-bold">+{goal.reward} XP</span>
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-sm text-gray-400 mb-1">
                    <span>Progression</span>
                    <span>{goal.progress}/{goal.total}</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full"
                      style={{ width: `${(goal.progress / goal.total) * 100}%` }}
                    />
                  </div>
                </div>
                <button className="w-full mt-2 py-2 bg-gradient-to-r from-purple-700 to-pink-700 rounded-lg font-medium hover:opacity-90 transition-opacity">
                  {goal.progress >= goal.total ? '✓ Terminé' : 'Continuer'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
