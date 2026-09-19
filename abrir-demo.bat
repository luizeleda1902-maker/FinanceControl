@echo off
REM Script para abrir o app em modo "demonstracao" (versao de producao,
REM igual ao que vai pro Netlify). So dar dois cliques neste arquivo.

cd /d "%~dp0"

echo ============================================
echo  Controle Financeiro - preparando demo
echo ============================================
echo.

call npm run build
if errorlevel 1 (
  echo.
  echo Ocorreu um erro ao gerar o app. Confira a mensagem acima.
  pause
  exit /b 1
)

echo.
echo Abrindo o app no navegador...
echo (para fechar depois, feche esta janela do terminal)
echo.

call npm run preview -- --open
