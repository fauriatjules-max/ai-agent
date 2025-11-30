@echo off
echo 🎬 Démarrage de ProVideoEditor...
echo.

:: Vérifier si Node.js est installé
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js n'est pas installé!
    echo 📥 Téléchargez-le depuis: https://nodejs.org
    pause
    exit /b 1
)

:: Vérifier si les dépendances sont installées
if not exist "node_modules" (
    echo 📦 Installation des dépendances...
    npm install
)

echo 🚀 Lancement de l'application...
npm run dev

pause
