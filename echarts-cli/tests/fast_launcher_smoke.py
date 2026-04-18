import json
import pathlib
import subprocess
import sys
import unittest


REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
LAUNCHER = REPO_ROOT / "bin" / "echarts"


class FastLauncherSmokeTest(unittest.TestCase):
    def run_cli(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["/usr/bin/python3", str(LAUNCHER), *args],
            cwd=REPO_ROOT,
            text=True,
            capture_output=True,
            check=False,
        )

    def test_list_json_matches_expected_shape(self) -> None:
        result = self.run_cli("list", "--format", "json")
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertTrue(any(item["name"] == "line" for item in payload["items"]))

    def test_option_tree_returns_expected_nodes(self) -> None:
        result = self.run_cli("option", "xAxis.axisLabel", "--tree")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("rotate", result.stdout)
        self.assertIn("formatter", result.stdout)


if __name__ == "__main__":
    unittest.main()
