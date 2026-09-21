import http.client
import json
import threading
import unittest
from unittest.mock import patch, MagicMock

import server


class TransportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.port = cls.http.server_address[1]
        cls.worker = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.worker.start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()

    def request(self, path, method="GET", body=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=3)
        conn.request(method, path, body=body, headers=headers or {})
        response = conn.getresponse()
        status, data, response_headers = response.status, response.read(), dict(response.getheaders())
        conn.close()
        return status, data, response_headers

    def test_index_and_module_mime(self):
        status, body, headers = self.request("/")
        self.assertEqual(status, 200)
        self.assertIn(server.TOKEN.encode(), body)
        self.assertNotIn(b"__SESSION_TOKEN__", body)
        self.assertIn("frame-ancestors 'none'", headers["Content-Security-Policy"])
        self.assertTrue(self.request("/core.mjs")[2]["Content-Type"].startswith("text/javascript"))

    def test_status_and_ports_work_without_hardware(self):
        self.assertEqual(self.request("/api/status")[0], 200)
        self.assertIn("ports", json.loads(self.request("/api/ports")[1]))

    def test_path_traversal_and_private_files_are_not_exposed(self):
        for path in ("/../server.py", "/%2e%2e/server.py", "/server.py", "/boards.json"):
            self.assertEqual(self.request(path)[0], 404)

    def test_foreign_host_and_origin_are_rejected(self):
        self.assertEqual(self.request("/", headers={"Host": "attacker.example"})[0], 403)
        self.assertEqual(self.request("/api/status", headers={"Origin": "https://attacker.example"})[0], 403)

    def test_post_requires_session_token(self):
        self.assertEqual(self.request("/api/disconnect", "POST", "{}")[0], 403)
        with patch.object(server.BRIDGE, "disconnect") as disconnect:
            self.assertEqual(self.request("/api/disconnect", "POST", "{}", {"X-FlowLab-Token": server.TOKEN})[0], 200)
            disconnect.assert_called_once()

    def test_invalid_json_and_unknown_routes(self):
        headers = {"X-FlowLab-Token": server.TOKEN}
        for body in ("[1]", "not JSON", ""):
            self.assertEqual(self.request("/api/connect", "POST", body, headers)[0], 400)
        self.assertEqual(self.request("/api/unknown", "POST", "{}", headers)[0], 404)


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.bridge = server.Bridge()
        self.bridge.connection = MagicMock()
        self.bridge.board = "esp32"

    def test_request_ignores_boot_text_and_wrong_sequence(self):
        self.bridge.connection.readline.side_effect = [b"boot:0x13\n", b'{"id":99,"ok":true}\n', b'{"id":1,"ok":true,"value":123}\n']
        self.assertEqual(self.bridge._request("adc", 34, 0), 123)
        self.bridge.connection.write.assert_called_once_with(b"1 adc 34 0\n")

    def test_firmware_error_propagates(self):
        self.bridge.connection.readline.return_value = b'{"id":1,"ok":false,"error":"GPIO busy"}\n'
        with self.assertRaisesRegex(ValueError, "GPIO busy"):
            self.bridge._request("write", 25, 1)

    def test_pin_validation_and_integer_validation(self):
        cases = [("write", {"pin": 34, "value": 1}), ("adc", {"pin": 6, "mode": "raw"}),
                 ("pwm", {"pin": 26, "value": 256, "frequency": 1000}),
                 ("write", {"pin": 25, "value": True}), ("write", {"pin": "25", "value": 1}),
                 ("read", {"pin": 34, "pull": "up"}), ("exec", {}),
                 ("i2c", {"sda": 21, "scl": 21}), ("i2cwrite", {"address": 5, "register": 0, "value": 1})]
        for command, args in cases:
            with self.subTest(command=command, args=args), self.assertRaises(ValueError):
                self.bridge.command(command, args)
        self.bridge.connection.write.assert_not_called()

    def test_known_commands_are_serialized(self):
        with patch.object(self.bridge, "_request", return_value=1) as request:
            self.bridge.command("pwm", {"pin": 26, "value": 128, "frequency": 1000})
            request.assert_called_with("pwm", 26, 128, 1000)
            self.bridge.command("adc", {"pin": 34, "mode": "millivolts"})
            request.assert_called_with("adc", 34, 1)

    def test_timeout_closes_connection(self):
        with patch.object(self.bridge, "_request", side_effect=TimeoutError("timeout")):
            with self.assertRaises(TimeoutError):
                self.bridge.command("ping", {})
            self.assertIsNone(self.bridge.connection)

    def test_connection_requires_matching_firmware_family(self):
        fake_serial = MagicMock()
        bridge = server.Bridge()
        with patch.object(server, "serial", fake_serial), patch.object(server, "ports", return_value=[{"port": "COM9"}]), patch.object(server.time, "sleep"), patch.object(bridge, "_request", return_value={"protocol": 1, "family": "esp32c3"}):
            with self.assertRaisesRegex(ValueError, "esp32c3"):
                bridge.connect("COM9", "esp32")
            self.assertIsNone(bridge.connection)

    def test_toolchain_has_fixed_actions_and_profiles(self):
        for action, board in (("rm", "esp32"), ("compile", "esp32;bad")):
            with self.assertRaises(ValueError):
                server.toolchain(action, board)


if __name__ == "__main__":
    unittest.main()
