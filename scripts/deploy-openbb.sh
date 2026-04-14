#!/usr/bin/env bash
# ============================================================
# OpenBB Dashboard — deploy as systemd service
# ============================================================
# Target:  VPS with setup-vps.sh + harden-ssh.sh already run.
# Purpose: Install Docker CE, find the project repo, validate
#          .env files, and register OpenBB as a systemd service
#          that starts automatically at boot.
#
# What this script does:
#   1. Install Docker CE + Compose plugin (if not present)
#   2. Add the current user to the docker group
#   3. Detect or prompt for the repo path
#   4. Validate that required .env files exist
#   5. Pull/build Docker images
#   6. Register + start openbb.service (systemd system service)
#   7. Open ufw ports 3000 (frontend) on tailscale0 only
#
# Usage:
#   bash scripts/deploy-openbb.sh
#   bash scripts/deploy-openbb.sh --repo /path/to/OpenBB
#
# Idempotent: safe to re-run (upgrades images + restarts service).
# ============================================================

set -euo pipefail

if [[ $EUID -eq 0 ]]; then
    echo "ERROR: do not run as root." >&2
    exit 1
fi
if ! sudo -v; then
    echo "ERROR: this user needs sudo access." >&2
    exit 1
fi
while true; do sudo -n true; sleep 50; kill -0 "$$" || exit; done 2>/dev/null &

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m  ✓ %s\033[0m\n' "$*"; }
skip(){ printf '\033[0;33m  - %s (already done)\033[0m\n' "$*"; }
err() { printf '\033[1;31m  ✗ %s\033[0m\n' "$*" >&2; }

# ── Parse args ───────────────────────────────────────────────
REPO_PATH=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --repo) REPO_PATH="$2"; shift 2 ;;
        *) echo "Unknown argument: $1" >&2; exit 1 ;;
    esac
done

# ── Auto-detect repo path if not provided ────────────────────
if [[ -z "$REPO_PATH" ]]; then
    CANDIDATES=(
        "$HOME/OpenBB"
        "$HOME/openbb"
        "$HOME/projects/OpenBB"
        "$(pwd)"
    )
    for c in "${CANDIDATES[@]}"; do
        if [[ -f "$c/docker-compose.yml" ]]; then
            REPO_PATH="$c"
            break
        fi
    done
fi

if [[ -z "$REPO_PATH" || ! -f "$REPO_PATH/docker-compose.yml" ]]; then
    err "Could not find the OpenBB repo (looking for docker-compose.yml)."
    err "Pass the path explicitly: bash scripts/deploy-openbb.sh --repo /path/to/OpenBB"
    err "Or clone the repo first: git clone git@github.com:matteobianchin/OpenBB.git ~/OpenBB"
    exit 1
fi
REPO_PATH=$(realpath "$REPO_PATH")
ok "Repo found at $REPO_PATH"

# ── 1. Install Docker CE ─────────────────────────────────────
log "Installing Docker CE"
if command -v docker >/dev/null 2>&1; then
    skip "Docker $(docker --version | cut -d' ' -f3 | tr -d ,) already installed"
else
    # Official Docker install script — safe, maintained by Docker
    curl -fsSL https://get.docker.com | sudo sh
    ok "Docker CE installed"
fi

# Compose plugin (v2) — `docker compose` (no hyphen)
if docker compose version >/dev/null 2>&1; then
    skip "Docker Compose $(docker compose version --short) already installed"
else
    sudo apt-get install -y -qq docker-compose-plugin
    ok "Docker Compose plugin installed"
fi

# ── 2. Add user to docker group ──────────────────────────────
log "Adding $USER to docker group"
if groups "$USER" | grep -q '\bdocker\b'; then
    skip "$USER already in docker group"
else
    sudo usermod -aG docker "$USER"
    ok "$USER added to docker group (takes effect after re-login)"
    # Use sg to apply group for the rest of this script without re-login
    DOCKER_CMD="sg docker -c"
else
    DOCKER_CMD="bash -c"
fi
DOCKER_CMD="${DOCKER_CMD:-bash -c}"

# ── 3. Validate .env files ───────────────────────────────────
log "Checking .env files"

# Root .env (docker-compose reads API keys from here)
if [[ ! -f "$REPO_PATH/.env" ]]; then
    err "Missing $REPO_PATH/.env"
    err "Copy the example and fill in the keys:"
    err "  cp $REPO_PATH/.env.example $REPO_PATH/.env"
    err "  nano $REPO_PATH/.env   # set FMP_API_KEY, TIINGO_API_KEY, FRED_API_KEY, ANTHROPIC_API_KEY"
    exit 1
fi

# Check that required keys are actually set (not empty, not placeholder)
REQUIRED_KEYS=(ANTHROPIC_API_KEY FMP_API_KEY)
MISSING_KEYS=()
for key in "${REQUIRED_KEYS[@]}"; do
    val=$(grep -E "^${key}=" "$REPO_PATH/.env" | cut -d= -f2- | tr -d '"'"'" | xargs 2>/dev/null || true)
    if [[ -z "$val" || "$val" == "your-"* || "$val" == "sk-ant-..." ]]; then
        MISSING_KEYS+=("$key")
    fi
done
if [[ ${#MISSING_KEYS[@]} -gt 0 ]]; then
    err "The following keys in $REPO_PATH/.env are empty or placeholder:"
    for k in "${MISSING_KEYS[@]}"; do err "  $k"; done
    exit 1
fi
ok ".env file present and keys set"

# ── 4. Build Docker images ───────────────────────────────────
log "Building Docker images (may take a few minutes first time)"
cd "$REPO_PATH"
# Use sg if user was just added to docker group; otherwise plain docker
if groups "$USER" | grep -q '\bdocker\b'; then
    docker compose build --pull
else
    sg docker -c "docker compose build --pull"
fi
ok "Images built"

# ── 5. Create systemd service ────────────────────────────────
log "Registering openbb.service"

SERVICE_FILE=/etc/systemd/system/openbb.service
sudo tee "$SERVICE_FILE" >/dev/null <<EOF
[Unit]
Description=OpenBB Dashboard (frontend + domain-api)
Documentation=https://github.com/matteobianchin/OpenBB
After=docker.service network-online.target
Requires=docker.service
Wants=network-online.target

[Service]
Type=simple
User=$USER
Group=docker
WorkingDirectory=$REPO_PATH

# Run in foreground so systemd owns the process tree
ExecStart=/usr/bin/docker compose up --remove-orphans

# Graceful stop: stop containers, then remove them
ExecStop=/usr/bin/docker compose down

# If compose crashes, wait 10s then retry
Restart=on-failure
RestartSec=10

# Give containers up to 60s to stop cleanly before SIGKILL
TimeoutStopSec=60

# Stdout/stderr appear in: journalctl -u openbb -f
StandardOutput=journal
StandardError=journal
SyslogIdentifier=openbb

[Install]
WantedBy=multi-user.target
EOF
ok "wrote $SERVICE_FILE"

sudo systemctl daemon-reload

# ── 6. Enable + (re)start the service ───────────────────────
log "Enabling and starting openbb.service"
sudo systemctl enable openbb >/dev/null
sudo systemctl restart openbb
ok "openbb.service started and enabled at boot"

# ── 7. Open ufw port on tailscale0 only ─────────────────────
log "Opening ports on tailscale0"
# Frontend :3000 on tailscale only — not exposed to the public internet
if sudo ufw status | grep -qE "3000.*tailscale0"; then
    skip "Port 3000 already open on tailscale0"
else
    sudo ufw allow in on tailscale0 to any port 3000 proto tcp comment 'OpenBB frontend (tailnet)' >/dev/null
    ok "Port 3000 open on tailscale0"
fi
# Domain API :6901 — internal only (Next.js proxy), NOT exposed even on tailnet
# If you ever want to hit the FastAPI docs directly from your laptop over tailnet,
# uncomment the line below:
# sudo ufw allow in on tailscale0 to any port 6901 proto tcp comment 'OpenBB domain-api (tailnet)'

# ── Done ─────────────────────────────────────────────────────
TS_IP=$(tailscale ip -4 2>/dev/null | head -1 || echo "<tailscale-ip>")
printf '\n\033[1;32mDeploy complete.\033[0m\n'
printf '\nService status:\n'
systemctl status openbb --no-pager -l | head -20 || true
printf '\nUseful commands:\n'
printf '  Status:   sudo systemctl status openbb\n'
printf '  Logs:     journalctl -u openbb -f\n'
printf '  Stop:     sudo systemctl stop openbb\n'
printf '  Start:    sudo systemctl start openbb\n'
printf '  Restart:  sudo systemctl restart openbb\n'
printf '\nDashboard (over Tailscale):\n'
printf '  http://%s:3000\n' "$TS_IP"
printf '\nNOTE: the Domain API (:6901) is intentionally NOT exposed externally.\n'
printf 'All data flows through the Next.js proxy at :3000.\n'
