#!/usr/bin/env bash
# ============================================================
# OpenBB Dashboard — install OpenClaw (persistent Claude Code workspace)
# ============================================================
# Target:  VPS with setup-vps.sh already run (Claude Code CLI installed).
# Purpose: Create a persistent tmux session named "openclaw" that
#          survives reboots via a systemd user service + loginctl linger.
#          You SSH in from any device, run `claw`, and you're inside
#          a live Claude Code workspace without losing context.
#
# What this script does:
#   1. Verify Claude Code CLI is installed and authenticated
#   2. Enable loginctl linger (user services start at boot, no login needed)
#   3. Install a systemd USER service that keeps the tmux session alive
#   4. Start the service immediately
#   5. Add the `claw` shell alias to ~/.bashrc
#
# Connect from any device:
#   ssh user@<tailscale-ip>
#   claw          ← attaches to the openclaw tmux session
#
# Stop the workspace (survives this, but stop if you want):
#   sudo loginctl disable-linger $USER  (stops autostart at boot)
#   systemctl --user stop openclaw      (stops the session now)
#
# Idempotent: safe to re-run.
# ============================================================

set -euo pipefail

if [[ $EUID -eq 0 ]]; then
    echo "ERROR: do not run as root." >&2
    exit 1
fi

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m  ✓ %s\033[0m\n' "$*"; }
skip(){ printf '\033[0;33m  - %s (already done)\033[0m\n' "$*"; }
err() { printf '\033[1;31m  ✗ %s\033[0m\n' "$*" >&2; }

# ── 1. Check Claude Code CLI ─────────────────────────────────
log "Checking Claude Code CLI"
if ! command -v claude >/dev/null 2>&1; then
    err "Claude Code CLI not found."
    err "Run scripts/setup-vps.sh first — it installs @anthropic-ai/claude-code."
    exit 1
fi
CLAUDE_VERSION=$(claude --version 2>/dev/null || echo "unknown")
ok "claude $CLAUDE_VERSION found at $(command -v claude)"

# Check authentication — `claude config list` exits non-zero if not authed
log "Checking Claude authentication"
if claude config list >/dev/null 2>&1; then
    ok "Claude is authenticated"
else
    printf '\n\033[1;33mClaude is not authenticated yet.\033[0m\n'
    printf 'Run the following to authenticate interactively:\n\n'
    printf '  claude\n\n'
    printf 'Then come back and re-run this script.\n'
    printf 'Or continue now — the openclaw workspace will start but claude\n'
    printf 'will ask for auth the first time you attach.\n\n'
    read -rp "Continue anyway? [y/N] " CONT
    if [[ "${CONT,,}" != "y" ]]; then
        exit 0
    fi
fi

# ── 2. Enable linger ─────────────────────────────────────────
log "Enabling loginctl linger for $USER"
# Linger = user services start at boot even without an active login session.
# Without it, your openclaw tmux session only exists while you're logged in.
if loginctl show-user "$USER" 2>/dev/null | grep -q "Linger=yes"; then
    skip "linger already enabled"
else
    sudo loginctl enable-linger "$USER"
    ok "linger enabled — user services will start at boot"
fi

# ── 3. Create systemd user service ───────────────────────────
log "Installing openclaw.service (user)"

SERVICE_DIR="$HOME/.config/systemd/user"
mkdir -p "$SERVICE_DIR"

SERVICE_FILE="$SERVICE_DIR/openclaw.service"

# Find tmux binary
TMUX_BIN=$(command -v tmux)

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=OpenClaw — persistent Claude Code workspace (tmux session)
After=default.target

[Service]
Type=forking

# Start a detached tmux session named "openclaw"
ExecStart=$TMUX_BIN new-session -d -s openclaw

# Kill the session on service stop
ExecStop=$TMUX_BIN kill-session -t openclaw

# If tmux dies unexpectedly, restart it after 5s
Restart=on-failure
RestartSec=5

# Tell systemd the service is "up" even though the forked child detached
RemainAfterExit=yes

[Install]
WantedBy=default.target
EOF
ok "wrote $SERVICE_FILE"

# Reload user daemon and enable
systemctl --user daemon-reload
systemctl --user enable openclaw >/dev/null
ok "openclaw.service enabled (starts at boot)"

# ── 4. Start the service now ─────────────────────────────────
log "Starting openclaw.service"
if systemctl --user is-active --quiet openclaw; then
    # Service already running — check if session exists
    if tmux has-session -t openclaw 2>/dev/null; then
        skip "openclaw tmux session already running"
    else
        # Service reports active but session is gone — restart
        systemctl --user restart openclaw
        ok "openclaw tmux session restarted"
    fi
else
    systemctl --user start openclaw
    ok "openclaw tmux session started"
fi

# Wait a moment and verify the session is actually there
sleep 1
if ! tmux has-session -t openclaw 2>/dev/null; then
    err "tmux session 'openclaw' did not start. Check: systemctl --user status openclaw"
    exit 1
fi
ok "tmux session 'openclaw' is live"

# ── 5. Add `claw` alias to ~/.bashrc ─────────────────────────
log "Adding 'claw' alias to ~/.bashrc"
BASHRC="$HOME/.bashrc"
MARKER='# >>> openclaw >>>'
if grep -q "$MARKER" "$BASHRC" 2>/dev/null; then
    skip "'claw' alias already in ~/.bashrc"
else
    cat >> "$BASHRC" <<'BASHEOF'

# >>> openclaw >>>
# Attach to the persistent OpenClaw workspace, or create it if missing.
claw() {
    if tmux has-session -t openclaw 2>/dev/null; then
        tmux attach-session -t openclaw
    else
        echo "openclaw session not found — starting it..."
        systemctl --user start openclaw && sleep 1
        tmux attach-session -t openclaw
    fi
}
# <<< openclaw <<<
BASHEOF
    ok "'claw' function added to ~/.bashrc"
fi

# ── Done ─────────────────────────────────────────────────────
TS_IP=$(tailscale ip -4 2>/dev/null | head -1 || echo "<tailscale-ip>")
printf '\n\033[1;32mOpenClaw workspace installed.\033[0m\n'
printf '\nTo connect from any device:\n\n'
printf '  ssh %s@%s\n' "$USER" "$TS_IP"
printf '  claw\n\n'
printf 'You'\''re now inside the openclaw tmux session.\n'
printf 'Run `claude` to start Claude Code in the current directory.\n'
printf '\nUseful commands (from inside or outside the session):\n'
printf '  systemctl --user status openclaw    # service status\n'
printf '  systemctl --user stop openclaw      # stop the session\n'
printf '  systemctl --user start openclaw     # start it again\n'
printf '  tmux ls                             # list all sessions\n'
printf '  Ctrl-b d                            # detach from tmux (session stays alive)\n'
printf '\nTo disable autostart at boot:\n'
printf '  systemctl --user disable openclaw\n'
printf '  sudo loginctl disable-linger %s\n' "$USER"
