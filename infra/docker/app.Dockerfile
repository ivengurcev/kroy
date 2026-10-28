FROM node:24.19.0-bookworm-slim

WORKDIR /app
COPY --chmod=755 infra/docker/app-entrypoint.sh /usr/local/bin/kroy-app-entrypoint
COPY --chmod=755 infra/docker/yarn.sh /usr/local/bin/yarn

ENTRYPOINT ["kroy-app-entrypoint"]
