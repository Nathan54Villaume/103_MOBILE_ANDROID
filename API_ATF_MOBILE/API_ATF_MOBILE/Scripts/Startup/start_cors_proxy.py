#!/usr/bin/env python3
"""
Serveur proxy CORS pour l'application DIRIS
Gère les problèmes de CORS et démarre l'application .NET
"""

import http.server
import socketserver
import urllib.request
import urllib.parse
import json
from urllib.error import URLError
import threading
import subprocess
import time
import os
import signal
import sys
import webbrowser
from pathlib import Path

# Configuration
FRONTEND_PORT = 8088
API_PORT = 8088  # Même port car l'API .NET sert aussi les fichiers statiques
API_HOST = "localhost"

class CORSProxyHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Ajouter les headers CORS
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        self.send_header('Access-Control-Allow-Credentials', 'true')
        super().end_headers()
    
    def do_OPTIONS(self):
        # Gérer les requêtes preflight CORS
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        # Rediriger les requêtes API vers le serveur .NET
        if self.path.startswith('/api/'):
            self.proxy_to_api()
        else:
            # Servir les fichiers statiques
            super().do_GET()
    
    def do_POST(self):
        if self.path.startswith('/api/'):
            self.proxy_to_api()
        else:
            super().do_POST()
    
    def do_PUT(self):
        if self.path.startswith('/api/'):
            self.proxy_to_api()
        else:
            super().do_PUT()
    
    def do_DELETE(self):
        if self.path.startswith('/api/'):
            self.proxy_to_api()
        else:
            super().do_DELETE()
    
    def proxy_to_api(self):
        """Rediriger la requête vers l'API .NET"""
        try:
            # Construire l'URL de l'API
            api_url = f"http://{API_HOST}:{API_PORT}{self.path}"
            
            # Préparer les headers
            headers = {}
            for header, value in self.headers.items():
                if header.lower() not in ['host', 'connection']:
                    headers[header] = value
            
            # Lire le body pour les requêtes POST/PUT
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = None
            if content_length > 0:
                post_data = self.rfile.read(content_length)
            
            # Créer la requête
            req = urllib.request.Request(api_url, data=post_data, headers=headers, method=self.command)
            
            # Envoyer la requête
            with urllib.request.urlopen(req, timeout=10) as response:
                # Lire la réponse
                response_data = response.read()
                
                # Envoyer les headers de réponse
                self.send_response(response.getcode())
                for header, value in response.headers.items():
                    if header.lower() not in ['connection', 'transfer-encoding']:
                        self.send_header(header, value)
                self.end_headers()
                
                # Envoyer le body de réponse
                self.wfile.write(response_data)
                
        except URLError as e:
            print(f"❌ Erreur de connexion à l'API: {e}")
            self.send_error(502, f"Bad Gateway: {e}")
        except Exception as e:
            print(f"❌ Erreur du proxy: {e}")
            self.send_error(500, f"Internal Server Error: {e}")
    
    def log_message(self, format, *args):
        """Personnaliser les logs"""
        print(f"[{self.address_string()}] {format % args}")

def start_dotnet_api():
    """Démarrer le serveur .NET en arrière-plan"""
    try:
        print("🚀 Démarrage du serveur .NET...")
        
        # Trouver le répertoire du projet
        script_dir = Path(__file__).parent
        project_dir = script_dir.parent.parent.parent.parent / "API_ATF_MOBILE" / "API_ATF_MOBILE"
        
        if not project_dir.exists():
            print(f"❌ Répertoire du projet non trouvé: {project_dir}")
            return None
        
        print(f"📁 Répertoire du projet: {project_dir}")
        os.chdir(project_dir)
        
        # Nettoyer et recompiler
        print("🧹 Nettoyage et recompilation...")
        subprocess.run(["dotnet", "clean"], check=True)
        subprocess.run(["dotnet", "build", "--configuration", "Release"], check=True)
        
        # Démarrer le serveur .NET
        process = subprocess.Popen(
            ["dotnet", "run", "--configuration", "Release", "--urls", f"http://localhost:{API_PORT}"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Attendre que le serveur démarre
        print("⏳ Attente du démarrage du serveur .NET...")
        time.sleep(15)  # Attendre 15 secondes
        
        # Vérifier si le processus est toujours en cours
        if process.poll() is None:
            print("✅ Serveur .NET démarré avec succès")
            return process
        else:
            stdout, stderr = process.communicate()
            print(f"❌ Erreur lors du démarrage du serveur .NET:")
            print(f"STDOUT: {stdout}")
            print(f"STDERR: {stderr}")
            return None
            
    except Exception as e:
        print(f"❌ Erreur lors du démarrage du serveur .NET: {e}")
        return None

def check_api_health():
    """Vérifier si l'API est accessible"""
    try:
        response = urllib.request.urlopen(f"http://{API_HOST}:{API_PORT}/api/values", timeout=5)
        return response.getcode() == 200
    except:
        return False

def main():
    print("🌐 Serveur Proxy CORS pour Application DIRIS")
    print("=" * 50)
    
    # Démarrer le serveur .NET
    dotnet_process = start_dotnet_api()
    
    if dotnet_process is None:
        print("❌ Impossible de démarrer le serveur .NET")
        print("💡 Assurez-vous que .NET 8.0 est installé et que le projet se compile")
        return
    
    # Attendre que l'API soit prête
    print("⏳ Vérification de la disponibilité de l'API...")
    max_attempts = 20
    for attempt in range(max_attempts):
        if check_api_health():
            print("✅ API .NET accessible")
            break
        time.sleep(2)
        print(f"⏳ Tentative {attempt + 1}/{max_attempts}...")
    else:
        print("❌ L'API .NET n'est pas accessible après 40 secondes")
        dotnet_process.terminate()
        return
    
    # Démarrer le serveur proxy
    try:
        with socketserver.TCPServer(("", FRONTEND_PORT), CORSProxyHandler) as httpd:
            print(f"🚀 Serveur proxy CORS démarré sur le port {FRONTEND_PORT}")
            print(f"📡 Redirection API vers http://{API_HOST}:{API_PORT}")
            print(f"🌐 Frontend accessible sur http://localhost:{FRONTEND_PORT}")
            print(f"📋 Swagger API sur http://localhost:{FRONTEND_PORT}/swagger")
            print(f"🎛️ Admin: http://localhost:{FRONTEND_PORT}/wwwroot/admin/index.html")
            print("=" * 50)
            print("Appuyez sur Ctrl+C pour arrêter le serveur")
            
            # Ouvrir automatiquement l'interface d'administration
            print("🌐 Ouverture de l'interface d'administration...")
            webbrowser.open(f"http://localhost:{FRONTEND_PORT}/wwwroot/admin/index.html")
            
            # Gérer l'arrêt propre
            def signal_handler(sig, frame):
                print("\n🛑 Arrêt du serveur...")
                if dotnet_process and dotnet_process.poll() is None:
                    dotnet_process.terminate()
                    dotnet_process.wait()
                sys.exit(0)
            
            signal.signal(signal.SIGINT, signal_handler)
            
            # Servir les requêtes
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n🛑 Arrêt du serveur...")
    except Exception as e:
        print(f"❌ Erreur du serveur proxy: {e}")
    finally:
        if dotnet_process and dotnet_process.poll() is None:
            print("🛑 Arrêt du serveur .NET...")
            dotnet_process.terminate()
            dotnet_process.wait()

if __name__ == "__main__":
    main()
