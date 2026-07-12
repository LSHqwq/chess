import http.server
import socketserver
import os
import webbrowser

PORT = 8000

# 获取当前目录
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(CURRENT_DIR)

# 列出当前目录的文件
print("=" * 50)
print("📁 当前目录:", CURRENT_DIR)
print("📄 文件列表:")
for file in os.listdir(CURRENT_DIR):
    print(f"   - {file}")
print("=" * 50)

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        print(f"📥 请求: {self.path}")
        super().do_GET()
    
    def log_message(self, format, *args):
        print(f"   ✅ {format % args}")

print(f"\n🚀 服务器启动: http://localhost:{PORT}\n")

webbrowser.open(f'http://localhost:{PORT}')

with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n⏹️ 服务器已停止")