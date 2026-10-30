#!/bin/sh
set -eu
base="${1:-http://localhost:8080}"
curl --fail --silent --show-error "$base/api/v1/health/live"
curl --fail --silent --show-error "$base/api/v1/health/ready"
curl --fail --silent --show-error --output /dev/null "$base/login"
