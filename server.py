import os
import sys
import json
import http.server
import socketserver
import urllib.parse
from http import HTTPStatus

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(BASE_DIR, "web")
def find_layouts_dir():
    candidates = [
        os.path.join(BASE_DIR, "Pacman-Game-master", "Pacman", "layouts"),
        os.path.join(BASE_DIR, "Pacman", "layouts"),
        os.path.join(BASE_DIR, "layouts"),
        os.path.join(os.getcwd(), "Pacman-Game-master", "Pacman", "layouts"),
        os.path.join(os.getcwd(), "Pacman", "layouts"),
        os.path.join(os.getcwd(), "layouts"),
    ]
    for cand in candidates:
        if os.path.isdir(cand):
            return cand
    return candidates[0]

LAYOUTS_DIR = find_layouts_dir()

class PacmanHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/layouts":
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.end_headers()
            layouts = []
            if os.path.isdir(LAYOUTS_DIR):
                for f in sorted(os.listdir(LAYOUTS_DIR)):
                    if f.endswith(".lay"):
                        layouts.append(f[:-4])
            if not layouts:
                layouts = [
                    'bigMaze', 'mediumClassic', 'mediumMaze', 'originalClassic',
                    'smallClassic', 'tinyMaze', 'trickySearch'
                ]
            self.wfile.write(json.dumps({"layouts": layouts}).encode("utf-8"))
            return

        elif path == "/api/layout":
            params = urllib.parse.parse_qs(parsed.query)
            layout_name = params.get("name", ["originalClassic"])[0]
            file_path = os.path.join(LAYOUTS_DIR, f"{layout_name}.lay")
            if not os.path.exists(file_path):
                file_path = os.path.join(LAYOUTS_DIR, "originalClassic.lay")

            if os.path.exists(file_path):
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read().splitlines()
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "name": layout_name,
                    "grid": content,
                    "width": max(len(line) for line in content) if content else 0,
                    "height": len(content)
                }).encode("utf-8"))
                return
            else:
                self.send_error(HTTPStatus.NOT_FOUND, "Layout not found")
                return

        return super().do_GET()

def run_server(port=PORT):
    # Enable address reuse so restarting works instantly
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), PacmanHTTPHandler) as httpd:
        print(f"==================================================")
        print(f" Pacman Web App running at: http://localhost:{port}")
        print(f"==================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")

if __name__ == "__main__":
    port = PORT
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    run_server(port)
