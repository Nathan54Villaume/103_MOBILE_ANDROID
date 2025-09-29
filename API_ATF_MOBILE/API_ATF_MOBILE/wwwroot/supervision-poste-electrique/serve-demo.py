#!/usr/bin/env python3
"""
Serveur de développement simple pour tester les courbes sans CORS
Usage: python serve-demo.py
Puis ouvrir: http://localhost:8000/demo-charts.html
"""

import http.server
import socketserver
import webbrowser
import os
from pathlib import Path

PORT = 8000

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=Path(__file__).parent, **kwargs)
    
    def end_headers(self):
        # Headers CORS pour le développement
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def start_server():
    """Démarre le serveur de développement"""
    os.chdir(Path(__file__).parent)
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}/demo-charts.html"
        print(f"🌐 Serveur de démo démarré: {url}")
        print("📊 Fonctionnalités disponibles:")
        print("   ✅ Reset - Restaure la vue d'origine")
        print("   ✅ Export - PNG horodaté")  
        print("   ✅ Paramètres - Modal d'aide")
        print("   ✅ Pan horizontal (clic + glisser)")
        print("   ✅ Zoom molette (X sur courbe, Y sur axe)")
        print("")
        print("🚀 Ouverture automatique du navigateur...")
        print("⏹️  CTRL+C pour arrêter")
        
        # Ouvrir le navigateur automatiquement
        try:
            webbrowser.open(url)
        except Exception:
            print("⚠️  Impossible d'ouvrir le navigateur automatiquement")
            print(f"   Ouvrez manuellement: {url}")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Serveur arrêté")

if __name__ == "__main__":
    start_server()
