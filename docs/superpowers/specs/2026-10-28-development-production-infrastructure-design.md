# Kroy Development/Production Infrastructure Design

## Intent

Add a reproducible Docker Compose development environment without replacing Kroy's existing non-Docker production deployment. Development and production must share the same application, publication algorithm, release format, rollback behavior, and Nginx configuration generator.

## Goals

- Keep production on system PostgreSQL, Node.js/Yarn PnP, systemd, system Nginx, and Ansible.
- Run local development through Compose with isolated PostgreSQL, app, and Kroy Nginx services.
- Preserve project data in `dist/` and `data/`, with matching absolute container paths for generated Nginx configuration.
- Make `site:publish <slug>` the single build-and-publish command used by CLI, admin API, and remote deploy.
- Serialize publications across Node processes and expose one `validate()`/`reload()` Nginx interface for both environments.

## Non-goals

- Docker in production.
- Changes to the editor UI, page data model, part model, or site rendering behavior.
- Docker socket access, a generic command service, polling, a broker, or a process orchestrator.
- Automatic database seeding or destructive changes to the host PostgreSQL instance.

## Constraints

- Node.js `24.19.0`, Yarn `4.18.1`, PnP only, and the existing `portal:./vyaz` dependency.
- Only Nginx is published to the host, on `127.0.0.1:8080`.
- The Nginx control endpoint is internal to the Compose network and supports only fixed validate and reload operations.
- Existing staging, immutable releases, asset versioning, five-release retention, config rollback, and site rollback remain intact.
- Existing Ansible content moves under `infra/ansible`, including the inventory and all relative path corrections.

## Approach

Use one Compose network and three services. The app bind-mounts the repository at `/app`, applies migrations after PostgreSQL is healthy, initializes the existing generated Nginx config, and runs the existing watch server. The Nginx container mounts `dist/sites` read-only and `dist/kroy/nginx` read-write at the same `/app` paths, runs Nginx plus a fixed internal HTTP control adapter, and is the only service with a host port.

Production Nginx control executes the current fixed `nginx -t` and `nginx -s reload` commands. Development control sends fixed POST requests to the internal adapter. Publication uses a PostgreSQL advisory lock so CLI and API calls are serialized across processes without stale filesystem locks. `site:build` remains preparation-only; `site:publish` acquires the lock, runs the build, then runs the existing release switch implementation.

## Alternatives considered

- Docker socket control was rejected because it grants excessive authority to the app container.
- Separate development publication code was rejected because it would diverge from production release and rollback behavior.
- File signals and polling were rejected because the requested reload must be direct and immediate.
- Replacing systemd/Ansible production with Compose was rejected because production explicitly remains non-Docker.

## Verification boundary

Static Node tests, configuration checks, `git diff --check`, and the existing production build can run locally. Full Compose lifecycle, browser behavior, real Nginx reload, PostgreSQL persistence, and VPS Ansible execution require Docker or the target VPS and are documented for manual verification.
