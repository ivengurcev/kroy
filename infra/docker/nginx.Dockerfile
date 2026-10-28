FROM node:24.19.0-bookworm-slim

RUN apt-get update \
    && apt-get install --yes --no-install-recommends nginx \
    && rm -rf /var/lib/apt/lists/*

COPY infra/nginx/controlServer.mjs /opt/kroy/controlServer.mjs
COPY infra/docker/nginx-entrypoint.mjs /opt/kroy/nginx-entrypoint.mjs

ENTRYPOINT ["node", "/opt/kroy/nginx-entrypoint.mjs"]
