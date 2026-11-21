FROM oven/bun:1.4.5

WORKDIR /app
COPY --chmod=755 infra/docker/app-entrypoint.sh /usr/local/bin/kroy-app-entrypoint
ENTRYPOINT ["kroy-app-entrypoint"]
