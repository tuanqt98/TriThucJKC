"""Restore must finish readiness before a caller reads Caddy's generated CA."""

import runpy
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class SnapshotReadinessTest(unittest.TestCase):
    def test_restore_waits_and_does_not_replace_existing_volume(self):
        script = Path(__file__).resolve().parents[1] / "staging/snapshot.py"
        for volume_exists in (False, True):
            with (
                self.subTest(volume_exists=volume_exists),
                tempfile.TemporaryDirectory(),
                patch.object(
                    sys,
                    "argv",
                    [
                        str(script),
                        "restore",
                        "--project",
                        "jkc-s01-test",
                        "--env-file",
                        "test.env",
                        "--set",
                        "test",
                    ],
                ),
                patch("subprocess.run") as run,
                patch("pathlib.Path.write_text"),
                patch("pathlib.Path.mkdir"),
            ):
                run.return_value.returncode = 0 if volume_exists else 1
                if volume_exists:
                    with self.assertRaises(SystemExit):
                        runpy.run_path(str(script), run_name="__main__")
                    self.assertEqual(run.call_count, 1)
                else:
                    runpy.run_path(str(script), run_name="__main__")
                    command = run.call_args_list[-1].args[0]
                    self.assertIn("--wait", command)
                    self.assertIn("--wait-timeout", command)
                    self.assertEqual(command[-1], "240")
