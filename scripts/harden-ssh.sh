#!/usr/bin/env bash
# ============================================================
# OpenBB Dashboard — SSH hardening script
# ============================================================
# Target:  VPS with setup-vps.sh already run AND Tailscale up.
# Purpose: Lock down sshd to key-only, non-root, user-whitelist,
#          and close the public :22 port at the ufw layer so SSH
#          is only reachable over the tailnet.
#
# Prerequisites (script aborts if missing — anti-lockout):
#   - Tailscale running and connected (`tailscale status` works)
#   - Current user has at least one key in ~/.ssh/authorized_keys
#   - sudo access
#
# Safety model:
#   - Writes a drop-in to /etc/ssh/sshd_config.d/99-hardening.conf
#     (never touches the main sshd_config → upgrade-safe)
#   - Runs `sshd -t` BEFORE asking you to restart
#   - Does NOT restart sshd automatically — prints the command
#     and forces you to open a second SSH session to verify
#     before losing the current one
#   - Idempotent: safe to re-run
# ============================================================

set -euo pipefail

if [[ $EUID -eq 0 ]]; then
    echo "ERROR: do not run as root. Run as the user who will keep SSH access." >&2
    exit 1
fi

if ! sudo -v; then
    echo "ERROR: this user needs sudo access." >&2
    exit 1
fi

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m  ✓ %s\033[0m\n' "$*"; }
skip(){ printf '\033[0;33m  - %s (already done)\033[0m\n' "$*"; }
err() { printf '\033[1;31m  ✗ %s\033[0m\n' "$*" >&2; }

# ------------------------------------------------------------
log "Pre-flight checks (anti-lockout)"
# ------------------------------------------------------------

# 1. Tailscale must be up — otherwise closing :22 WAN leaves no way in
if ! command -v tailscale >/dev/null 2>&1; then
    err "tailscale binary not found. Install it first: curl -fsSL https://tailscale.com/install.sh | sh"
    exit 1
fi
if ! tailscale status >/dev/null 2>&1; then
    err "tailscale is not connected. Run 'sudo tailscale up' and authenticate first."
    exit 1
fi
TS_IP=$(tailscale ip -4 2>/dev/null | head -1)
if [[ -z "$TS_IP" ]]; then
    err "Could not read Tailscale IPv4 address."
    exit 1
fi
ok "Tailscale up — this host is reachable at $TS_IP"

# 2. authorized_keys must exist and be non-empty — otherwise password auth off = locked out
AUTH_KEYS="$HOME/.ssh/authorized_keys"
if [[ ! -s "$AUTH_KEYS" ]]; then
    err "$AUTH_KEYS is missing or empty."
    err "Add your public key BEFORE running this script, e.g.:"
    err "  mkdir -p ~/.ssh && chmod 700 ~/.ssh"
    err "  echo 'ssh-ed25519 AAAA... you@laptop' >> ~/.ssh/authorized_keys"
    err "  chmod 600 ~/.ssh/authorized_keys"
    exit 1
fi
KEY_COUNT=$(grep -c -E '^(ssh-|ecdsa-|sk-)' "$AUTH_KEYS" || true)
if [[ "$KEY_COUNT" -lt 1 ]]; then
    err "$AUTH_KEYS exists but contains no recognizable public keys."
    exit 1
fi
ok "authorized_keys has $KEY_COUNT key(s)"

# 3. ufw must already be active (installed by setup-vps.sh)
if ! sudo ufw status | grep -q "Status: active"; then
    err "ufw is not active. Run scripts/setup-vps.sh first."
    exit 1
fi
ok "ufw is active"

# ------------------------------------------------------------
log "Writing sshd drop-in config"
# ------------------------------------------------------------
# We write to /etc/ssh/sshd_config.d/99-hardening.conf — a drop-in
# directory loaded by the main sshd_config via `Include`. This keeps
# package upgrades from clobbering our changes and lets you revert
# by deleting one file.
#
# Design choices (see CLAUDE.md conversation for the trade-off table):
#   - PasswordAuthentication no    → keys only, no brute-force surface
#   - PermitRootLogin no           → no root SSH at all, use sudo
#   - PubkeyAuthentication yes     → the only accepted method
#   - KbdInteractiveAuthentication → block PAM challenge-response paths
#   - AllowUsers <current-user>    → whitelist — other system users
#                                    (e.g. for services) cannot SSH even
#                                    if they somehow get a key
#   - MaxAuthTries 3               → kill the connection after 3 bad
#                                    attempts (belt-and-suspenders with fail2ban)
#   - LoginGraceTime 30            → 30s to authenticate or dropped
#   - ListenAddress NOT set        → sshd stays on 0.0.0.0; ufw is what
#                                    actually enforces "tailnet only".
#                                    Rationale: avoids a boot-order race
#                                    where sshd starts before tailscale0
#                                    exists and fails to bind.

DROPIN=/etc/ssh/sshd_config.d/99-hardening.conf
TMP=$(mktemp)
cat > "$TMP" <<EOF
# Managed by scripts/harden-ssh.sh — do not edit by hand.
# Delete this file and restart sshd to revert.

PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
UsePAM yes

AllowUsers $USER

MaxAuthTries 3
LoginGraceTime 30
EOF

if sudo test -f "$DROPIN" && sudo cmp -s "$TMP" "$DROPIN"; then
    skip "$DROPIN already up to date"
    rm -f "$TMP"
else
    sudo install -o root -g root -m 0644 "$TMP" "$DROPIN"
    rm -f "$TMP"
    ok "wrote $DROPIN"
fi

# ------------------------------------------------------------
log "Validating sshd config"
# ------------------------------------------------------------
# sshd -t parses the ENTIRE config (main + all drop-ins) and exits
# non-zero on syntax error. This is the single most important step:
# if this fails, DO NOT restart sshd — you'll be locked out on next login.
if ! sudo sshd -t; then
    err "sshd config validation failed. Fix the errors above before restarting."
    err "Your current SSH session is still fine — sshd has NOT been reloaded."
    exit 1
fi
ok "sshd -t passed"

# ------------------------------------------------------------
log "Tightening ufw: close public :22, keep tailnet"
# ------------------------------------------------------------
# setup-vps.sh opened 22/tcp as a break-glass rule. Now that Tailscale
# works we delete it and rely on 'allow in on tailscale0'.
if sudo ufw status | grep -E '^22/tcp\s+ALLOW' >/dev/null; then
    sudo ufw delete allow 22/tcp >/dev/null
    ok "removed public 'allow 22/tcp' rule"
else
    skip "public :22 rule already removed"
fi

# Make sure the tailscale0 allow rule is present (idempotent re-add)
if sudo ufw status | grep -q 'tailscale0'; then
    skip "tailscale0 allow rule already present"
else
    sudo ufw allow in on tailscale0 comment 'Tailscale peers' >/dev/null
    ok "added 'allow in on tailscale0'"
fi

# ------------------------------------------------------------
log "Done — MANUAL restart required (on purpose)"
# ------------------------------------------------------------
cat <<EOF

\033[1;33mSSH hardening is staged but NOT yet active.\033[0m
The sshd config has been written and validated, and ufw has been
tightened, but sshd has NOT been restarted. Follow this sequence:

  \033[1;36m1.\033[0m  In THIS terminal, keep the current SSH session open.
      Do not close it. It is your safety net.

  \033[1;36m2.\033[0m  In a NEW terminal on your laptop, open a second SSH
      session to this VPS over Tailscale:

          ssh $USER@$TS_IP

      If that works, you have proof that key auth + tailnet route
      both function. You can also try the public hostname — it
      should still work RIGHT NOW because sshd hasn't reloaded yet.

  \033[1;36m3.\033[0m  Once the second session is confirmed working, from
      EITHER session run:

          sudo systemctl restart ssh

  \033[1;36m4.\033[0m  From a THIRD new terminal, test again:

          ssh $USER@$TS_IP        # should succeed (tailnet)
          ssh $USER@<public-ip>   # should HANG then fail (ufw blocks)

      If (4) both behave as expected, the hardening is live. You
      can now safely close the original session.

  \033[1;36m5.\033[0m  If anything goes wrong and you lose SSH, use the
      Hetzner web console to log in, check 'sudo journalctl -u ssh',
      and if needed delete /etc/ssh/sshd_config.d/99-hardening.conf
      and restart sshd.

EOF
