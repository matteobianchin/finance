#!/usr/bin/env bash
# ============================================================
# OpenBB Dashboard — VPS first login (run as root)
# ============================================================
# Target:  Hetzner CX32, Ubuntu 24.04 LTS, brand new server.
# Purpose: Create a non-root sudo user and copy the root SSH
#          authorized_keys so you can log in as that user and
#          run all subsequent scripts.
#
# Run this ONCE, as root, immediately after the VPS is created:
#
#   ssh root@<public-ip>
#   curl -fsSL https://raw.githubusercontent.com/matteobianchin/OpenBB/main/scripts/first-login.sh | bash
#
# OR copy-paste it line by line from the Hetzner web console.
#
# After this script completes:
#   1. Log out as root
#   2. Log in as the new user: ssh <username>@<public-ip>
#   3. Run: bash scripts/setup-vps.sh
# ============================================================

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
    echo "ERROR: this script must be run as root." >&2
    exit 1
fi

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m  ✓ %s\033[0m\n' "$*"; }

# ── Prompt for username ──────────────────────────────────────
log "Creating non-root sudo user"
read -rp "  Username to create (e.g. matteo): " NEW_USER
if [[ -z "$NEW_USER" ]]; then
    echo "ERROR: username cannot be empty." >&2
    exit 1
fi

if id "$NEW_USER" >/dev/null 2>&1; then
    ok "User $NEW_USER already exists — skipping creation"
else
    adduser --gecos "" "$NEW_USER"
    ok "User $NEW_USER created"
fi

# Add to sudo group
usermod -aG sudo "$NEW_USER"
ok "$NEW_USER added to sudo group"

# ── Copy SSH authorized_keys from root ───────────────────────
log "Copying SSH authorized_keys from root to $NEW_USER"
USER_HOME="/home/$NEW_USER"
mkdir -p "$USER_HOME/.ssh"
chmod 700 "$USER_HOME/.ssh"

if [[ -f /root/.ssh/authorized_keys ]]; then
    cp /root/.ssh/authorized_keys "$USER_HOME/.ssh/authorized_keys"
    chmod 600 "$USER_HOME/.ssh/authorized_keys"
    chown -R "$NEW_USER:$NEW_USER" "$USER_HOME/.ssh"
    KEY_COUNT=$(grep -c -E '^(ssh-|ecdsa-|sk-)' "$USER_HOME/.ssh/authorized_keys" || true)
    ok "Copied $KEY_COUNT key(s) from root — $NEW_USER can now SSH with the same key"
else
    echo ""
    echo "  WARNING: /root/.ssh/authorized_keys not found."
    echo "  You need to manually add your public key before logging out as root:"
    echo ""
    echo "    mkdir -p /home/$NEW_USER/.ssh"
    echo "    echo 'ssh-ed25519 AAAA... you@laptop' >> /home/$NEW_USER/.ssh/authorized_keys"
    echo "    chmod 600 /home/$NEW_USER/.ssh/authorized_keys"
    echo "    chown -R $NEW_USER:$NEW_USER /home/$NEW_USER/.ssh"
    echo ""
fi

# ── Disable root SSH login ───────────────────────────────────
# Root login will be disabled at the sshd level.
# We do NOT touch sshd_config here — harden-ssh.sh handles that.
# But we do lock the root password so `su -` from other users
# requires a password that doesn't exist (extra safety layer).
log "Locking root password (login via SSH key still works until harden-ssh.sh)"
passwd -l root >/dev/null
ok "root password locked (sudo still works for $NEW_USER)"

# ── Done ─────────────────────────────────────────────────────
PUBLIC_IP=$(curl -s -4 ifconfig.me 2>/dev/null || echo "<public-ip>")
printf '\n\033[1;32mFirst login setup complete.\033[0m\n'
printf '\nNext steps:\n\n'
printf '  1. Open a NEW terminal and verify login as %s:\n\n' "$NEW_USER"
printf '       ssh %s@%s\n\n' "$NEW_USER" "$PUBLIC_IP"
printf '  2. Once confirmed, log out as root.\n\n'
printf '  3. As %s, run the base provisioning script:\n\n' "$NEW_USER"
printf '       bash <(curl -fsSL https://raw.githubusercontent.com/matteobianchin/OpenBB/main/scripts/setup-vps.sh)\n\n'
printf '     OR after cloning the repo:\n\n'
printf '       bash scripts/setup-vps.sh\n\n'
