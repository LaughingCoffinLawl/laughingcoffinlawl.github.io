#!/usr/bin/env python3
"""
Avvia un server HTTP locale per giocare al DLE.
Uso: python play.py
Poi visita: http://localhost:8000
"""

import http.server
import socketserver
import os

PORT = 8000

# Cambia directory alla cartella del progetto
os.chdir(os.path.dirname(os.path.abspath(__file__)))

Handler = http.server.SimpleHTTPRequestHandler

print(f"🎮 Metin2 DLE - Server avviato!")
print(f"📍 Apri il browser e visita: http://localhost:{PORT}")
print(f"🛑 Premi Ctrl+C per fermare il server")
print()

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Server fermato")