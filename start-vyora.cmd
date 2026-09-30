@echo off
start "VYORA Backend" "%~dp0start-backend.cmd"
start "VYORA Frontend" "%~dp0start-frontend.cmd"
echo Open http://127.0.0.1:5173 after both servers are ready.
echo Keep Ollama running for local AI chat.
