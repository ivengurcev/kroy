#!/bin/sh
set -eu

mkdir -p "$HOME" dist/sites dist/kroy/nginx-dev data/media
YARN_JS=/app/.yarn/releases/yarn-4.18.1.cjs
node "$YARN_JS" install --immutable
node "$YARN_JS" db:migrate
node "$YARN_JS" nginx:init
export NODE_OPTIONS="--require /app/.pnp.cjs --experimental-loader file:///app/.pnp.loader.mjs${NODE_OPTIONS:+ $NODE_OPTIONS}"
exec node scripts/dev.mjs
