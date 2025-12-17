#!/usr/bin/env node

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

console.log('🚀 Déploiement de Duolingo du Pilotage...\n')

// Vérifier les dépendances
console.log('📦 Vérification des dépendances...')
try {
  execSync('npm --version', { stdio: 'inherit' })
  console.log('✅ Node.js/npm détecté')
} catch {
  console.error('❌ Node.js/npm non installé')
  process.exit(1)
}

// Installation des dépendances
console.log('\n📦 Installation des dépendances...')
try {
  execSync('npm install', { cwd: rootDir, stdio: 'inherit' })
  console.log('✅ Dépendances installées')
} catch (error) {
  console.error('❌ Erreur installation dépendances:', error.message)
  process.exit(1)
}

// Build de l'application
console.log('\n🔨 Construction de l\'application...')
try {
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' })
  console.log('✅ Build terminé')
} catch (error) {
  console.error('❌ Erreur build:', error.message)
  process.exit(1)
}

// Génération des assets PWA
console.log('\n🎨 Génération des assets PWA...')
try {
  const { default: pwaAssetGenerator } = await import('pwa-asset-generator')
  
  const result = await pwaAssetGenerator.generateImages(
    path.join(rootDir, 'public/logo.png'),
    path.join(rootDir, 'public'),
    {
      scrape: false,
      background: '#0f172a',
      splashOnly: true,
      portraitOnly: true,
      log: false,
      padding: '10%',
      darkMode: true
    }
  )
  
  console.log('✅ Assets PWA générés')
} catch (error) {
  console.warn('⚠️  Erreur génération assets PWA:', error.message)
}

// Déploiement Vercel (optionnel)
console.log('\n🌐 Déploiement sur Vercel...')
console.log('Pour déployer sur Vercel gratuitement:')
console.log('1. Créez un compte sur https://vercel.com')
console.log('2. Installez Vercel CLI: npm i -g vercel')
console.log('3. Exécutez: vercel --prod')
console.log('\n🌐 Déploiement sur Netlify...')
console.log('Alternative gratuite:')
console.log('1. Créez un compte sur https://netlify.com')
console.log('2. Drag & drop le dossier "dist" sur Netlify')
console.log('\n📱 Déploiement en PWA...')
console.log('Votre application est prête pour installation:')
console.log('- Build dans: dist/')
console.log('- Service Worker activé')
console.log('- Manifest PWA configuré')

// Générer un rapport
console.log('\n📊 Rapport de build:')
const distDir = path.join(rootDir, 'dist')
if (fs.existsSync(distDir)) {
  const files = fs.readdirSync(distDir)
  const totalSize = files.reduce((acc, file) => {
    const stats = fs.statSync(path.join(distDir, file))
    return acc + stats.size
  }, 0)
  
  console.log(`- ${files.length} fichiers générés`)
  console.log(`- Taille totale: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
  console.log(`- Service Worker: ${fs.existsSync(path.join(distDir, 'sw.js')) ? '✅ Actif' : '❌ Inactif'}`)
}

console.log('\n✨ Déploiement prêt !')
console.log('\nCommandes disponibles:')
console.log('  npm run dev          # Développement local')
console.log('  npm run build        # Build production')
console.log('  npm run preview      # Prévisualisation production')
console.log('  npm run deploy:vercel # Déploiement Vercel')
console.log('  npm run deploy:netlify # Déploiement Netlify')
