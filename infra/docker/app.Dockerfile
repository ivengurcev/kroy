FROM oven/bun:1.4.4

WORKDIR /app
COPY --chmod=755 infra/docker/app-entrypoint.sh /usr/local/bin/kroy-app-entrypoint
ENTRYPOINT ["kroy-app-entrypoint"]
