"""Authenticated, bounded request/response stream with exclusive device ownership."""
import json
import secrets
import threading

LEASE = threading.Lock()


def handle_socket(socket, bridge, token, busy=lambda: False):
    owned = False
    try:
        first = json.loads(socket.recv(timeout=5))
        if not isinstance(first, dict) or first.get('op') != 'auth' or not isinstance(first.get('args'), dict):
            socket.close(1008, 'Authentication required')
            return
        candidate = first['args'].get('token')
        if not isinstance(candidate, str) or not secrets.compare_digest(candidate, token):
            socket.close(1008, 'Authentication failed')
            return
        owned = LEASE.acquire(blocking=False)
        if not owned:
            socket.send(json.dumps({'id': first.get('id'), 'ok': False, 'error': 'Otra sesión controla el dispositivo.'}))
            return
        socket.send(json.dumps({'id': first.get('id'), 'ok': True, 'value': {'transport': 'ws', 'protocol': 2}}))
        last_id = first.get('id', 0)
        if type(last_id) is not int or last_id < 1:
            return
        for raw in socket:
            request_id = None
            try:
                message = json.loads(raw)
                if not isinstance(message, dict):
                    raise ValueError('Mensaje inválido.')
                request_id = message.get('id')
                if type(request_id) is not int or not last_id < request_id <= 9007199254740991:
                    raise ValueError('ID inválido.')
                last_id = request_id
                op, args = message.get('op'), message.get('args', {})
                if not isinstance(args, dict):
                    raise ValueError('Argumentos inválidos.')
                if busy():
                    raise ValueError('La herramienta de compilación está ocupada.')
                if op == 'connect':
                    value = bridge.connect(args.get('port'), args.get('board'))
                elif op == 'command':
                    value = bridge.command(args.get('command'), args.get('args', {}))
                elif op == 'disconnect':
                    bridge.disconnect()
                    value = {'connected': False}
                elif op == 'status':
                    value = bridge.status()
                else:
                    raise ValueError('Operación no permitida.')
                result = {'id': request_id, 'ok': True, 'value': value}
            except (ValueError, TypeError, OSError, TimeoutError) as exc:
                result = {'id': request_id, 'ok': False, 'error': str(exc)}
            socket.send(json.dumps(result, ensure_ascii=False, allow_nan=False))
    except Exception:
        # A transport failure always releases the physical device. No write replay.
        pass
    finally:
        if owned:
            try:
                bridge.disconnect()
            finally:
                LEASE.release()


def start_ws(bridge, token, http_port, busy=lambda: False):
    from websockets.sync.server import serve
    origins = [f'http://127.0.0.1:{http_port}', f'http://localhost:{http_port}']
    listener = serve(lambda socket: handle_socket(socket, bridge, token, busy),
                     '127.0.0.1', 0, origins=origins, compression=None,
                     max_size=65536, max_queue=8, open_timeout=5, close_timeout=2,
                     ping_interval=10, ping_timeout=10)
    threading.Thread(target=listener.serve_forever, daemon=True).start()
    return listener, listener.socket.getsockname()[1]
