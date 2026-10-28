# Kroy Development/Production Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an isolated Compose development stack while preserving Kroy's existing non-Docker production deployment and unifying publication/Nginx control.

**Architecture:** Compose runs PostgreSQL, the existing Kroy watch server, and a dedicated Nginx at matching `/app` paths. Publication remains one release algorithm, protected by a PostgreSQL advisory lock, while a small environment-aware Nginx module selects direct production commands or a fixed internal development endpoint.

**Tech Stack:** JavaScript ESM, Node.js 24.19.0, Yarn 4.18.1 PnP, Docker Compose, PostgreSQL 16, Nginx, Ansible.

**Spec:** `docs/superpowers/specs/2026-10-28-development-production-infrastructure-design.md`

## Global Constraints

- Keep JavaScript and existing Kroy/Vyaz implementations; add no application dependency.
- Do not use Docker in production or touch the local system Nginx/PostgreSQL.
- Keep generated configurations/releases in `dist/` and media in `data/`.
- Publish only `127.0.0.1:8080`; keep app, PostgreSQL, and control API internal.
- Do not add tests or test infrastructure; use the existing focused checks required by `AGENTS.md`.
- Do not commit or deploy.

## Review Focus

- A failed build must not modify the active release or Nginx configuration.
- A failed validate/reload must restore the previous generated config.
- Simultaneous CLI/API publication attempts must not build or switch concurrently.
- App/nginx absolute paths must both resolve to `/app/dist/...` in Compose.
- Ctrl+C must reach the watch processes and leave no Compose service running.

---

### Task 1: Move production infrastructure under `infra/`

**Files:**
- Move: `ansible/**` to `infra/ansible/**`
- Move: `inventory` to `infra/ansible/inventory`
- Modify: `package.json`, `scripts/deploy.mjs`, `infra/ansible/*.yml`, `infra/ansible/README.md`, `README.md`

**Interfaces:**
- Produces: production entry points rooted at `infra/ansible` with corrected project-root and rsync paths.

- [ ] Move files without changing playbook behavior.
- [ ] Correct `playbook_dir`-relative project/assets paths and rsync exclusions.
- [ ] Correct package, deploy script, and documentation commands.
- [ ] Check all old `ansible/` and root `inventory` references with `rg`.

### Task 2: Add the Compose development stack

**Files:**
- Create: `infra/compose.yaml`
- Create: `infra/docker/app.Dockerfile`
- Create: `infra/docker/nginx.Dockerfile`
- Create: `infra/docker/app-entrypoint.sh`
- Create: `infra/docker/nginx-entrypoint.sh`
- Create: `infra/nginx/controlServer.mjs`
- Create: `scripts/devService.mjs`
- Modify: `package.json`, `.env.example`

**Interfaces:**
- Produces: `dev`, `dev:bg`, `dev:down`, `dev:logs`, `dev:status`, `dev:restart`, and `dev:rebuild` commands.
- Produces: internal `POST /validate` and `POST /reload` on the Nginx service only.

- [ ] Define one internal network, a PostgreSQL named volume, required bind mounts, healthchecks, and only the loopback Nginx port.
- [ ] Run install, migrations, Nginx config initialization, and the existing watcher as the host UID/GID without seeding.
- [ ] Run Nginx and its fixed control server with signal forwarding.
- [ ] Validate restart/rebuild service names before invoking Compose.
- [ ] Inspect the resolved Compose config when Docker is available.

### Task 3: Unify Nginx control

**Files:**
- Create: `infra/nginx/index.mjs`
- Modify: `scripts/nginxControl.mjs`, `scripts/publishSite.mjs`, `scripts/rollbackSite.mjs`

**Interfaces:**
- Produces: `nginx.validate()` and `nginx.reload()`.
- Consumes: optional fixed `KROY_NGINX_CONTROL_URL`; otherwise fixed local Nginx binary/config.

- [ ] Implement direct production commands and fixed development HTTP calls.
- [ ] Route CLI validation, publication, rollback, and config restoration through the shared module.
- [ ] Preserve previous config restore behavior on errors.

### Task 4: Make publication one cross-process workflow

**Files:**
- Move: current prepared-release logic to `scripts/publishPreparedSite.mjs`
- Create: `scripts/publishSite.mjs`
- Modify: `api/sitePublish.mjs`, `scripts/deploy.mjs`, `scripts/help.mjs`, `README.md`, `docs/ARCHITECTURE.md`, `docs/ROUTING.md`

**Interfaces:**
- Produces: `site:build <slug>` as preparation-only and `site:publish <slug>` as locked build plus release switch.
- Consumes: PostgreSQL advisory lock held for the complete workflow.

- [ ] Acquire a non-blocking advisory lock before spawning the existing build and prepared-publish phases.
- [ ] Forward termination to the active child and release the database lock in `finally`.
- [ ] Make the admin API spawn only `site:publish` and retain its status reporting.
- [ ] Make remote site deploy invoke only `site:publish`.
- [ ] Update help and architecture wording to the new contract.

### Task 5: Document operation and safe migration

**Files:**
- Create: `infra/README.md`
- Modify: `README.md`

**Interfaces:**
- Produces: first-run, command, diagnostics, publication, limitations, and host PostgreSQL dump/restore instructions.

- [ ] Document non-destructive startup and named-volume persistence.
- [ ] Document dump/restore without modifying or deleting the host PostgreSQL instance.
- [ ] Document fixed Nginx validation command, publication/rollback, and manual verification scope.

### Task 6: Focused verification

**Files:** none.

**Interfaces:**
- Consumes: all preceding deliverables.

- [ ] Run existing focused Node tests for Nginx/release behavior.
- [ ] Run `git diff --check`.
- [ ] Run one production build command if the existing environment is ready.
- [ ] Report Docker/VPS/browser checks separately when those environments are unavailable.
