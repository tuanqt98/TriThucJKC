"""Run from repository root with PYTHONPATH=starter/apps/api."""

import argparse
from pathlib import Path

import yaml
from app.main import create_app
from openapi_spec_validator import validate_spec

parser = argparse.ArgumentParser()
parser.add_argument("--check", action="store_true")
args = parser.parse_args()
spec = create_app().openapi()
validate_spec(spec)
output = yaml.safe_dump(spec, allow_unicode=True, sort_keys=False)
path = Path("api/openapi.yaml")
if args.check:
    assert path.read_text() == output, "OpenAPI drift: chạy scripts/export_openapi.py"
else:
    path.write_text(output)
print("OpenAPI hợp lệ và khớp code.")
