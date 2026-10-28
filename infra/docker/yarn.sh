#!/bin/sh
set -eu

exec node /app/.yarn/releases/yarn-4.18.1.cjs "$@"
