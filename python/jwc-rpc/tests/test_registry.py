from __future__ import annotations

import json
import os
import unittest
from pathlib import Path

from jwc_rpc import RpcClient, SessionHandle, list_sessions


class RegistryTests(unittest.TestCase):
    def test_list_sessions_returns_live_record(self) -> None:
        with self.subTest("explicit sessions_dir"):
            with tempfile_dir() as root:
                sessions = root / "rpc-sessions"
                sessions.mkdir(parents=True)
                payload = {
                    "sessionId": "sess-a",
                    "pid": os.getpid(),
                    "transport": "stdio",
                    "cwd": "/tmp/work",
                    "startedAt": "2026-06-14T12:00:00.000Z",
                    "model": "claude-sonnet-4-6",
                }
                (sessions / "sess-a.json").write_text(json.dumps(payload), encoding="utf-8")

                found = list_sessions(sessions)
                self.assertEqual(len(found), 1)
                handle = found[0]
                self.assertIsInstance(handle, SessionHandle)
                self.assertEqual(handle.session_id, "sess-a")
                self.assertEqual(handle.pid, os.getpid())
                self.assertEqual(handle.model, "claude-sonnet-4-6")

                via_client = RpcClient.list_sessions(sessions)
                self.assertEqual(found, via_client)

    def test_list_sessions_socket_transport_with_endpoint(self) -> None:
        with tempfile_dir() as root:
            sessions = root / "rpc-sessions"
            sessions.mkdir(parents=True)
            payload = {
                "sessionId": "sock-1",
                "pid": os.getpid(),
                "transport": "socket",
                "endpoint": "/tmp/jwc-rpc.sock",
                "cwd": "/tmp/work",
                "startedAt": "2026-06-14T14:00:00.000Z",
            }
            (sessions / "sock-1.json").write_text(json.dumps(payload), encoding="utf-8")

            found = list_sessions(sessions)
            self.assertEqual(len(found), 1)
            handle = found[0]
            self.assertEqual(handle.transport, "socket")
            self.assertEqual(handle.endpoint, "/tmp/jwc-rpc.sock")

    def test_reaps_dead_pid(self) -> None:
        with tempfile_dir() as root:
            sessions = root / "rpc-sessions"
            sessions.mkdir(parents=True)
            entry = sessions / "stale.json"
            entry.write_text(
                json.dumps(
                    {
                        "sessionId": "stale",
                        "pid": 2_147_483_647,
                        "transport": "stdio",
                        "cwd": "",
                        "startedAt": "2026-01-01T00:00:00.000Z",
                    }
                ),
                encoding="utf-8",
            )
            self.assertEqual(list_sessions(sessions), ())
            self.assertFalse(entry.exists())

    def test_agent_dir_from_jwc_env(self) -> None:
        with tempfile_dir() as agent_root:
            sessions = agent_root / "rpc-sessions"
            sessions.mkdir(parents=True)
            (sessions / "env.json").write_text(
                json.dumps(
                    {
                        "sessionId": "env",
                        "pid": os.getpid(),
                        "transport": "stdio",
                        "cwd": "",
                        "startedAt": "2026-06-14T13:00:00.000Z",
                    }
                ),
                encoding="utf-8",
            )
            prior = os.environ.get("JWC_CODING_AGENT_DIR")
            try:
                os.environ["JWC_CODING_AGENT_DIR"] = str(agent_root)
                found = list_sessions()
                self.assertEqual(len(found), 1)
                self.assertEqual(found[0].session_id, "env")
            finally:
                if prior is None:
                    os.environ.pop("JWC_CODING_AGENT_DIR", None)
                else:
                    os.environ["JWC_CODING_AGENT_DIR"] = prior


class tempfile_dir:
    """Minimal temp directory helper without importing tempfile in hot path."""

    def __init__(self) -> None:
        import tempfile

        self._cm = tempfile.TemporaryDirectory()
        self.path: Path | None = None

    def __enter__(self) -> Path:
        name = self._cm.__enter__()
        self.path = Path(name)
        return self.path

    def __exit__(self, *args: object) -> None:
        self._cm.__exit__(*args)


if __name__ == "__main__":
    unittest.main()