@echo off
rem Baixa do Interactive os precos de heritage, talents, defenses e as tags dos personagens,
rem e refaz WaifuCatalogBuildFix.html com os dados novos.
rem Precisa do Node.js instalado (https://nodejs.org).
cd /d "%~dp0"
node atualizar-dados.mjs
pause
