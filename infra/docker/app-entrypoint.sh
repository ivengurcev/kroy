#!/bin/sh
set -eu

mkdir -p "$HOME" dist/sites dist/kroy/nginx-dev data/media
bun install --frozen-lockfile
bun run db:migrate
bun run nginx:init
exec bun run scripts/dev.mjs
