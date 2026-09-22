"""FlowLab local host. Python 3.10+; pyserial is optional until hardware is used."""
from __future__ import annotations

import argparse
import atexit
import functools
import json
import mimetypes
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote
import webbrowser
from ws_service import LEASE, start_ws
WS_PORT = None

ROOT = Path(__file__).resolve().parent
APP_DIR = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else ROOT
WEB = ROOT / "web"
PROFILES = json.loads((ROOT / "boards.json").read_text(encoding="utf-8"))
TOKEN = secrets.token_urlsafe(32)
try:
    import serial
    import serial.tools.list_ports
except ImportError:
    serial = None


def ports():
    if serial is None:
        return []
    return [{"port": p.device, "description": p.description, "manufacturer": p.manufacturer}
            for p in serial.tools.list_ports.comports()]


def integer(data, key, low, high):
    value = data.get(key)
    if type(value) is not int or not low <= value <= high:
        raise ValueError(f"{key}: se requiere un entero entre {low} y {high}.")
    return value


class Bridge:
    def __init__(self):
        self.lock = threading.RLock()
        self.connection = None
        self.board = None
        self.port = None
        self.sequence = 0
        self.info = None

    def connect(self, port, board):
        with self.lock:
            if serial is None:
                raise ValueError("Instala pyserial: python -m pip install -r requirements.txt")
            if board not in PROFILES:
                raise ValueError("Perfil de placa desconocido.")
            if port not in [p["port"] for p in ports()]:
                raise ValueError("El puerto no está disponible. Actualiza la lista.")
            self.disconnect()
            try:
                self.connection = serial.Serial(port, 115200, timeout=0.15, write_timeout=1)
                self.port, self.board = port, board
                time.sleep(1.8)  # USB/UART reset and boot ROM messages.
                self.connection.reset_input_buffer()
                self.info = self._request("hello")
                if not isinstance(self.info, dict) or self.info.get("protocol") not in (1, 2, 3):
                    raise ValueError("Firmware incompatible; carga FlowLabBridge.")
                if self.info.get("family") != board:
                    raise ValueError(f"La placa responde como {self.info.get('family')}, no {board}.")
                return self.status()
            except Exception:
                self.disconnect()
                raise

    def status(self):
        with self.lock:
            return {"connected": self.connection is not None, "port": self.port,
                    "board": self.board, "info": self.info}

    def _request(self, command, *args):
        if self.connection is None:
            raise ValueError("No hay una placa conectada.")
        self.sequence += 1
        seq = self.sequence
        line = " ".join(map(str, (seq, command, *args))) + "\n"
        self.connection.write(line.encode("ascii"))
        deadline = time.monotonic() + (12 if command == 'burst' else 2.5)
        buffer = bytearray()
        while time.monotonic() < deadline:
            raw = self.connection.readline(65536)
            if not raw:
                continue
            buffer.extend(raw)
            if len(buffer) > 100000:
                raise ValueError('Trama serie demasiado grande.')
            if not buffer.endswith(b'\n'):
                continue
            try:
                response = json.loads(buffer)
            except (ValueError, UnicodeError):
                buffer.clear()
                continue  # Ignore bootloader diagnostics.
            buffer.clear()
            if not isinstance(response, dict) or response.get("id") != seq:
                continue
            if not response.get("ok"):
                raise ValueError(response.get("error", "Error del firmware."))
            return response.get("value")
        raise TimeoutError("La placa no respondió. Revisa el firmware y el puerto USB.")

    def command(self, command, args):
        with self.lock:
            if self.connection is None:
                raise ValueError("No hay una placa conectada.")
            if not isinstance(args, dict):
                raise ValueError("Argumentos inválidos.")
            b = PROFILES[self.board]
            params = []
            if command in ("hello", "stop", "ping", "scan"):
                pass
            elif command in ('dac', 'touch', 'pcnt', 'tone'):
                if not self.info or self.info.get('protocol') != 3:
                    raise ValueError('Carga FlowLabBridge 0.3 (protocolo 3).')
                pin = integer(args, 'pin', 0, 54)
                if pin not in b['gpio'] or command in ('dac', 'tone') and pin in b['inputOnly']:
                    raise ValueError('GPIO inválido para el periférico.')
                if command in ('dac', 'touch') and pin not in b[command]:
                    raise ValueError('Periférico o pin no disponible en esta familia.')
                params = [pin]
                if command == 'dac':
                    params.append(integer(args, 'value', 0, 255))
                elif command == 'pcnt':
                    if not b['pcnt']:
                        raise ValueError('PCNT no disponible en esta familia.')
                    params += [integer(args, 'gateMs', 10, 1000), integer(args, 'filterNs', 0, 10000)]
                elif command == 'tone':
                    frequency = integer(args, 'frequency', 0, 20000)
                    if 0 < frequency < 20:
                        raise ValueError('Tone: 0 o 20–20000 Hz.')
                    params.append(frequency)
            elif command in ("adc", "read", "write", "pwm"):
                pin = integer(args, "pin", 0, 54)
                if pin not in b["gpio"]:
                    raise ValueError("GPIO fuera del perfil permitido.")
                if command in ("write", "pwm") and pin in b["inputOnly"]:
                    raise ValueError("GPIO solamente de entrada.")
                params.append(pin)
                if command == "adc":
                    if pin not in b["adc"] or args.get("mode") not in ("raw", "millivolts"):
                        raise ValueError("Pin o modo ADC inválido.")
                    params.append(int(args["mode"] == "millivolts"))
                elif command == "read":
                    if args.get("pull") not in ("none", "up", "down"):
                        raise ValueError("Pull inválido.")
                    if pin in b["inputOnly"] and args["pull"] != "none":
                        raise ValueError("Este pin no tiene pull interno.")
                    params.append({"none": 0, "up": 1, "down": 2}[args["pull"]])
                elif command == "write":
                    params.append(integer(args, "value", 0, 1))
                else:
                    params += [integer(args, "value", 0, 255), integer(args, "frequency", 100, 20000)]
            elif command == "i2c":
                sda, scl = integer(args, "sda", 0, 54), integer(args, "scl", 0, 54)
                if sda == scl or any(p not in b["gpio"] or p in b["inputOnly"] for p in (sda, scl)):
                    raise ValueError("Pines I²C inválidos.")
                params = [sda, scl]
            elif command == 'burst':
                if not self.info or self.info.get('protocol') not in (2, 3):
                    raise ValueError('La adquisición por ráfaga requiere protocolo 2.')
                pin = integer(args, 'pin', 0, 54)
                if pin not in b['adc']:
                    raise ValueError('GPIO no admite ADC en este perfil.')
                trigger = args.get('trigger')
                if trigger not in ('immediate', 'rising', 'falling'):
                    raise ValueError('Trigger inválido.')
                count = integer(args, 'count', 16, 4096)
                pre = integer(args, 'pre', 0, count - 1)
                if trigger == 'immediate' and pre:
                    raise ValueError('Pretrigger requiere flanco.')
                params = [pin, integer(args, 'rate', 20000, 80000), count,
                          ('immediate', 'rising', 'falling').index(trigger), integer(args, 'level', 0, 4095),
                          pre, integer(args, 'timeout', 100, 5000)]
            elif command == 'i2cxfer':
                if not self.info or self.info.get('protocol') not in (2, 3):
                    raise ValueError('I²C multibyte requiere protocolo 2.')
                tx = args.get('tx')
                if not isinstance(tx, list) or len(tx) > 32 or any(type(v) is not int or not 0 <= v <= 255 for v in tx):
                    raise ValueError('I²C: máximo 32 bytes de escritura.')
                read_count = integer(args, 'readCount', 0, 32)
                if type(args.get('stop')) is not bool or not tx and not read_count:
                    raise ValueError('Transacción vacía o stop inválido.')
                params = [integer(args, 'address', 8, 119), len(tx), read_count, int(args['stop']), *tx]
            elif command in ("i2cread", "i2cwrite"):
                params = [integer(args, "address", 8, 119), integer(args, "register", 0, 255)]
                if command == "i2cwrite":
                    params.append(integer(args, "value", 0, 255))
            else:
                raise ValueError("Comando no permitido.")
            try:
                return self._request(command, *params)
            except (OSError, TimeoutError):
                self.disconnect()
                raise

    def disconnect(self):
        with self.lock:
            if self.connection:
                try:
                    self._request("stop")
                except Exception:
                    pass
                try:
                    self.connection.close()
                except Exception:
                    pass
            self.connection = self.board = self.port = self.info = None


BRIDGE = Bridge()
atexit.register(BRIDGE.disconnect)
JOB_LOCK = threading.Lock()
JOB = {"running": False, "ok": None, "log": "", "action": None}


def arduino_cli():
    bundled = APP_DIR / "tools" / ("arduino-cli.exe" if os.name == "nt" else "arduino-cli")
    return str(bundled) if bundled.is_file() else shutil.which("arduino-cli")


def toolchain(action, board, port=None):
    if action not in ("compile", "upload") or board not in PROFILES:
        raise ValueError("Acción o placa no válida.")
    executable = arduino_cli()
    if not executable:
        raise ValueError("Arduino CLI no está instalado o no está en PATH. Consulta README.md.")
    if action == "upload" and port not in [p["port"] for p in ports()]:
        raise ValueError("Selecciona un puerto disponible antes de cargar.")
    with JOB_LOCK:
        if JOB["running"]:
            raise ValueError("Ya hay una compilación o carga en curso.")
        JOB.update(running=True, ok=None, log="Iniciando Arduino CLI…", action=action)

    def worker():
        success = False
        output = []
        try:
            # Serialize firmware work against connect/commands for its full duration.
            with BRIDGE.lock:
                BRIDGE.disconnect()
                build = APP_DIR / "work" / "build" / board
                build.mkdir(parents=True, exist_ok=True)
                commands = [[executable, "compile", "--fqbn", PROFILES[board]["fqbn"],
                             "--build-path", str(build), str(ROOT / "firmware" / "FlowLabBridge")]]
                if action == "upload":
                    commands.append([executable, "upload", "-p", port, "--fqbn", PROFILES[board]["fqbn"],
                                     "--input-dir", str(build), str(ROOT / "firmware" / "FlowLabBridge")])
                for cmd in commands:
                    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
                                            timeout=900, shell=False,
                                            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
                    output.append(result.stdout + result.stderr)
                    with JOB_LOCK:
                        JOB["log"] = "\n".join(output)[-40000:]
                    if result.returncode:
                        raise ValueError(f"Arduino CLI terminó con código {result.returncode}.")
                success = True
        except Exception as exc:
            output.append(str(exc))
        finally:
            with JOB_LOCK:
                JOB.update(running=False, ok=success, log="\n".join(output)[-40000:])
    threading.Thread(target=worker, daemon=True).start()
    return {"started": True}


class Handler(BaseHTTPRequestHandler):
    server_version = "FlowLab/0.4.1"

    def log_message(self, fmt, *args):
        if len(args) > 1 and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)

    def send_data(self, value, status=200, content_type="application/json; charset=utf-8"):
        data = json.dumps(value, ensure_ascii=False).encode() if isinstance(value, (dict, list)) else value
        if isinstance(data, str):
            data = data.encode()
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        ws_source = f' ws://127.0.0.1:{WS_PORT}' if WS_PORT else ''
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'" + ws_source + "; object-src 'none'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(data)

    def allowed(self, mutation=False):
        port = self.server.server_address[1]
        hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
        if self.headers.get("Host") not in hosts:
            self.send_data({"error": "Host no permitido."}, 403)
            return False
        origin = self.headers.get("Origin")
        if origin and origin not in {f"http://{h}" for h in hosts}:
            self.send_data({"error": "Origen no permitido."}, 403)
            return False
        if mutation and not secrets.compare_digest(self.headers.get("X-FlowLab-Token", ""), TOKEN):
            self.send_data({"error": "Sesión inválida. Recarga la aplicación."}, 403)
            return False
        return True

    def do_GET(self):
        if not self.allowed():
            return
        path = unquote(urlparse(self.path).path)
        if path == "/api/status":
            # Avoid waiting on the bridge lock while the compiler runs.
            with JOB_LOCK:
                busy = JOB["running"]
            self.send_data({"version": "0.4.1", "wsUrl": f'ws://127.0.0.1:{WS_PORT}' if WS_PORT else None, "serialInstalled": serial is not None,
                            "arduinoCli": arduino_cli() is not None,
                            "bridge": {"connected": False} if busy else BRIDGE.status(), "toolchainBusy": busy})
        elif path == "/api/ports":
            self.send_data({"ports": ports()})
        elif path == "/api/job":
            with JOB_LOCK:
                snapshot = dict(JOB)
            self.send_data(snapshot)
        elif path == "/firmware/FlowLabBridge.ino":
            self.send_data((ROOT / "firmware" / "FlowLabBridge" / "FlowLabBridge.ino").read_bytes(), content_type="text/plain; charset=utf-8")
        else:
            target = (WEB / (path.lstrip("/") or "index.html")).resolve()
            if not target.is_relative_to(WEB) or not target.is_file():
                self.send_data({"error": "Archivo no encontrado."}, 404)
                return
            content = target.read_bytes()
            if target.name == "index.html":
                content = content.replace(b"__SESSION_TOKEN__", TOKEN.encode())
            mime = "text/javascript" if target.suffix == ".mjs" else mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            self.send_data(content, content_type=mime + "; charset=utf-8")

    def do_POST(self):
        leased = False
        if not self.allowed(mutation=True):
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 65536:
                raise ValueError("Solicitud vacía o demasiado grande.")
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError("Se requiere un objeto JSON.")
            path = urlparse(self.path).path
            if path in ('/api/connect', '/api/disconnect', '/api/command', '/api/toolchain'):
                leased = LEASE.acquire(blocking=False)
                if not leased:
                    raise ValueError('La placa pertenece a otra sesión. Desconéctala primero.')
            with JOB_LOCK:
                busy = JOB["running"]
            if busy and path != "/api/toolchain":
                raise ValueError("Espera a que termine la compilación/carga.")
            if path == "/api/connect":
                result = BRIDGE.connect(data.get("port"), data.get("board"))
            elif path == "/api/disconnect":
                BRIDGE.disconnect()
                result = {"connected": False}
            elif path == "/api/command":
                result = {"value": BRIDGE.command(data.get("command"), data.get("args", {}))}
            elif path == "/api/toolchain":
                result = toolchain(data.get("action"), data.get("board"), data.get("port"))
            else:
                self.send_data({"error": "Ruta no encontrada."}, 404)
                return
            self.send_data(result)
        except (ValueError, TypeError, OSError, TimeoutError) as exc:
            self.send_data({"error": str(exc)}, 400)
        except Exception as exc:
            self.send_data({"error": "Error interno: " + str(exc)}, 500)
        finally:
            if leased:
                LEASE.release()


def main():
    global WS_PORT
    parser = argparse.ArgumentParser(description="FlowLab · laboratorio visual local")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    ws_listener = None
    try:
        ws_listener, WS_PORT = start_ws(BRIDGE, TOKEN, server.server_address[1], lambda: JOB['running'])
    except ImportError:
        print('WebSocket no instalado; instala requirements.txt o usa WebSerial.', flush=True)
    url = f"http://127.0.0.1:{server.server_address[1]}"
    print(f"FlowLab 0.4.1 · {url}\nCtrl+C para cerrar.", flush=True)
    if not args.no_browser:
        threading.Timer(0.6, functools.partial(webbrowser.open, url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        BRIDGE.disconnect()
        if ws_listener:
            ws_listener.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
