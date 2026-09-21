"""Start a built executable (or Python source) on a free port, without any USB access."""
import json
import queue
import re
import subprocess
import sys
import threading
import urllib.request
from websockets.sync.client import connect


def check(command):
    process = subprocess.Popen([*command, '--port', '0', '--no-browser'],
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                               text=True, encoding='utf-8', errors='replace')
    lines = queue.Queue()
    def reader():
        for line in process.stdout:
            lines.put(line)
    thread = threading.Thread(target=reader, daemon=True)
    thread.start()
    try:
        import time
        deadline = time.monotonic() + 20
        base = None
        while time.monotonic() < deadline:
            try:
                line = lines.get(timeout=.2)
            except queue.Empty:
                if process.poll() is not None:
                    raise RuntimeError('El servidor termino antes de anunciar su URL.')
                continue
            match = re.search(r'http://127\.0\.0\.1:\d+', line)
            if match:
                base = match.group()
                break
        if not base:
            raise RuntimeError('Timeout de arranque.')
        with urllib.request.urlopen(base + '/api/status', timeout=5) as response:
            status = json.load(response)
        assert status['version'] == '0.2.0' and status['wsUrl']
        with urllib.request.urlopen(base + '/', timeout=5) as response:
            html = response.read().decode()
        token = re.search(r'name="flowlab-token" content="([^"]+)"', html).group(1)
        with connect(status['wsUrl'], origin=base, proxy=None) as ws:
            ws.send(json.dumps({'id': 1, 'op': 'auth', 'args': {'token': token}}))
            assert json.loads(ws.recv(timeout=5))['ok']
            ws.send(json.dumps({'id': 2, 'op': 'status', 'args': {}}))
            value = json.loads(ws.recv(timeout=5))
            assert value['ok'] and not value['value']['connected']
        for asset in ('app.mjs', 'core.mjs', 'transports.mjs', 'data.mjs', 'project-store.mjs'):
            with urllib.request.urlopen(base + '/' + asset, timeout=5) as response:
                assert response.status == 200 and 'javascript' in response.headers['Content-Type']
        print('OK: arranque, version, WebSocket autenticado y modulos. No se abrio ningun puerto USB.')
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        thread.join(timeout=2)
        process.stdout.close()


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit('Uso: python smoke-distribution.py EJECUTABLE [ARGUMENTOS]')
    check(sys.argv[1:])
