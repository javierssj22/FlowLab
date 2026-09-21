#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if ! command -v node >/dev/null 2>&1; then
    printf '%s\n' 'Este modo necesita Node.js 20+. El modo normal usa Python: sh start.sh' >&2
    exit 1
fi
exec node scripts/serve-webserial.mjs
