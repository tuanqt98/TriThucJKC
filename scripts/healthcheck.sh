#!/bin/sh
set -eu
base="${1:-http://localhost:8080}"
request() {
    if [ -n "${JKC_CA_CERT:-}" ]; then
        curl --fail --silent --show-error --cacert "$JKC_CA_CERT" "$@"
    else
        curl --fail --silent --show-error "$@"
    fi
}
request "$base/api/v1/health/live"
request "$base/api/v1/health/ready"
request --output /dev/null "$base/login"
