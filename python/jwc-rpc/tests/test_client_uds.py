from __future__ import annotations
import io

import json
import socket
import tempfile
import threading
import unittest
from pathlib import Path

from jwc_rpc import RpcClient

_HAS_AF_UNIX = hasattr(socket, "AF_UNIX")


def _minimal_session_state() -> dict[str, object]:
    return {
        "sessionId": "uds-test-session",
        "steeringMode": "one-at-a-time",
        "followUpMode": "one-at-a-time",
        "interruptMode": "immediate",
        "messageCount": 0,
        "queuedMessageCount": 0,
        "dumpTools": [],
    }


@unittest.skipUnless(_HAS_AF_UNIX, "socket.AF_UNIX is unavailable on this platform")
class RpcClientUdsTests(unittest.TestCase):
    def test_connect_unix_get_state_and_stop_without_process(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            sock_path = Path(tmp) / "rpc.sock"
            server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            server.bind(str(sock_path))
            server.listen(1)

            ready = threading.Event()
            request_seen = threading.Event()

            def serve() -> None:
                conn, _ = server.accept()
                with io.TextIOWrapper(conn.makefile("rwb", buffering=0), encoding="utf-8", newline="\n", write_through=True) as stream:
                    stream.write(
                        json.dumps(
                            {
                                "type": "ready",
                                "protocolVersion": 2,
                                "sessionId": "uds-test-session",
                            }
                        )
                        + "\n"
                    )
                    stream.flush()
                    ready.set()
                    line = stream.readline()
                    if not line:
                        return
                    request = json.loads(line)
                    request_seen.set()
                    request_id = request.get("id")
                    stream.write(
                        json.dumps(
                            {
                                "id": request_id,
                                "type": "response",
                                "command": "get_state",
                                "success": True,
                                "data": _minimal_session_state(),
                            }
                        )
                        + "\n"
                    )
                    stream.flush()

            thread = threading.Thread(target=serve, daemon=True)
            thread.start()

            client = RpcClient.connect_unix(sock_path, startup_timeout=5.0, request_timeout=5.0)
            try:
                self.assertTrue(ready.wait(timeout=5.0))
                state = client.get_state()
                self.assertEqual(state.session_id, "uds-test-session")
                self.assertTrue(request_seen.wait(timeout=5.0))
                self.assertIsNone(client._process)
                client.stop()
                self.assertIsNone(client._socket)
            finally:
                server.close()
                thread.join(timeout=2.0)


if __name__ == "__main__":
    unittest.main()