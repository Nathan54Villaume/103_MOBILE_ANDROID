#!/usr/bin/env python3
import http.server
import socketserver
import urllib.request
import urllib.parse
import json
from urllib.error import URLError

class CORSProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/proxy/'):
            try:
                # Extraire l'URL cible après /proxy/
                target_url = self.path[7:]  # Remove /proxy/
                if not target_url.startswith('http'):
                    target_url = 'http://' + target_url
                
                print(f"Proxying request to: {target_url}")
                
                # Faire la requête vers l'API réelle
                req = urllib.request.Request(target_url)
                req.add_header('User-Agent', 'Mozilla/5.0')
                
                with urllib.request.urlopen(req, timeout=10) as response:
                    data = response.read()
                    
                # Envoyer la réponse avec les headers CORS
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(data)
                
            except URLError as e:
                print(f"URL Error: {e}")
                self.send_error(502, f"Bad Gateway: {e}")
            except Exception as e:
                print(f"Error: {e}")
                self.send_error(500, f"Internal Server Error: {e}")
        else:
            # Servir les fichiers statiques normalement
            super().do_GET()
    
    def do_OPTIONS(self):
        # Gérer les requêtes preflight CORS
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == "__main__":
    PORT = 8088
    print(f"🚀 Proxy CORS démarré sur http://localhost:{PORT}")
    print(f"📡 Pour accéder à l'API: http://localhost:{PORT}/proxy/http://10.250.13.4:8088/api/energy")
    
    with socketserver.TCPServer(("", PORT), CORSProxyHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Proxy CORS arrêté")
            httpd.shutdown()
