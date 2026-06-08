from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class SpaHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        requested_path = self.path.split("?", 1)[0].lstrip("/")
        if requested_path and not (Path.cwd() / requested_path).exists():
            self.path = "/index.html"
        super().do_GET()


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 5173), SpaHandler)
    server.serve_forever()
