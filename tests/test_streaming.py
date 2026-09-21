import json
import threading
import time
import unittest
from unittest.mock import MagicMock, patch
from websockets.sync.client import connect
from websockets.exceptions import ConnectionClosed, InvalidStatus
import server
from ws_service import start_ws, LEASE


class StreamingTests(unittest.TestCase):
    def setUp(self):
        self.bridge = MagicMock()
        self.bridge.command.return_value = [1, 2, 3]
        self.bridge.status.return_value = {'connected': False}
        self.listener, self.port = start_ws(self.bridge, 'secret', 9876)
        self.url = f'ws://127.0.0.1:{self.port}'

    def tearDown(self):
        self.listener.shutdown()
        for _ in range(100):
            if not LEASE.locked():
                break
            time.sleep(.01)
        self.assertFalse(LEASE.locked())

    def open(self, token='secret'):
        ws = connect(self.url, origin='http://127.0.0.1:9876', proxy=None)
        ws.send(json.dumps({'id': 1, 'op': 'auth', 'args': {'token': token}}))
        return ws

    def test_origin_and_token_are_required(self):
        with self.assertRaises(InvalidStatus):
            connect(self.url, origin='https://foreign.example', proxy=None)
        with self.open('wrong') as ws:
            with self.assertRaises(ConnectionClosed):
                ws.recv(timeout=2)
        self.bridge.command.assert_not_called()

    def test_exclusive_session_and_disconnect_release_device(self):
        with self.open() as ws:
            self.assertTrue(json.loads(ws.recv(timeout=2))['ok'])
            with self.open() as second:
                self.assertFalse(json.loads(second.recv(timeout=2))['ok'])
            ws.send(json.dumps({'id': 2, 'op': 'command', 'args': {'command': 'i2cxfer', 'args': {'tx': [0]}}}))
            self.assertEqual(json.loads(ws.recv(timeout=2))['value'], [1, 2, 3])
            self.bridge.command.assert_called_once_with('i2cxfer', {'tx': [0]})
            # Replay must not repeat a physical write.
            ws.send(json.dumps({'id': 2, 'op': 'command', 'args': {'command': 'write'}}))
            self.assertFalse(json.loads(ws.recv(timeout=2))['ok'])
            self.bridge.command.assert_called_once()
        for _ in range(100):
            if self.bridge.disconnect.called:
                break
            time.sleep(.01)
        self.assertTrue(self.bridge.disconnect.called)

    def test_invalid_messages_do_not_crash_or_dispatch(self):
        with self.open() as ws:
            ws.recv(timeout=2)
            for message in ['bad JSON', '[]', '{"id":true}', '{"id":2,"op":"eval","args":{}}']:
                ws.send(message)
                self.assertFalse(json.loads(ws.recv(timeout=2))['ok'])
            self.bridge.command.assert_not_called()

    def test_http_cannot_mutate_websocket_owned_device(self):
        import http.client
        http_server = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        thread = threading.Thread(target=http_server.serve_forever, daemon=True)
        thread.start()
        try:
            with self.open() as ws:
                ws.recv(timeout=2)
                conn = http.client.HTTPConnection('127.0.0.1', http_server.server_address[1])
                conn.request('POST', '/api/disconnect', '{}', {'X-FlowLab-Token': server.TOKEN})
                response = conn.getresponse()
                self.assertEqual(response.status, 400)
                response.read()
                conn.close()
        finally:
            http_server.shutdown()
            http_server.server_close()


class BatchBridgeTests(unittest.TestCase):
    def setUp(self):
        self.bridge = server.Bridge()
        self.bridge.connection = MagicMock()
        self.bridge.board = 'esp32'
        self.bridge.info = {'protocol': 2}

    def test_i2c_and_burst_are_serialized_without_truncation(self):
        with patch.object(self.bridge, '_request', return_value=[]) as request:
            self.bridge.command('i2cxfer', {'address': 72, 'tx': [0, 255], 'readCount': 6, 'stop': False})
            request.assert_called_with('i2cxfer', 72, 2, 6, 0, 0, 255)
            self.bridge.command('burst', {'pin': 34, 'rate': 20000, 'count': 4096, 'trigger': 'rising', 'level': 2048, 'pre': 512, 'timeout': 5000})
            request.assert_called_with('burst', 34, 20000, 4096, 1, 2048, 512, 5000)

    def test_partial_serial_lines_reassemble_large_burst(self):
        value = {'kind': 'waveform', 'samples': [4095] * 4096, 'dt': .00005, 't0': 0}
        line = (json.dumps({'id': 1, 'ok': True, 'value': value}) + '\n').encode()
        self.bridge.connection.readline.side_effect = [line[i:i+128] for i in range(0, len(line), 128)]
        self.assertEqual(self.bridge._request('burst'), value)

    def test_protocol_and_bounds_fail_before_writes(self):
        cases = [dict(address=72, tx=[256], readCount=1, stop=False),
                 dict(address=72, tx=[], readCount=0, stop=False),
                 dict(address=72, tx=[0]*33, readCount=1, stop=False),
                 dict(address=72, tx=[0], readCount=True, stop=False)]
        for args in cases:
            with self.assertRaises(ValueError):
                self.bridge.command('i2cxfer', args)
        self.bridge.info = {'protocol': 1}
        with self.assertRaises(ValueError):
            self.bridge.command('burst', {})
        self.bridge.connection.write.assert_not_called()


if __name__ == '__main__':
    unittest.main()
