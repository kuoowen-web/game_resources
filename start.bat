@echo off
cd /d "%~dp0"
call venv\Scripts\activate
cd server
python app.py
