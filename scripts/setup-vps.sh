#!/usr/bin/env bash
# ============================================================
# OpenBB Dashboard — VPS base provisioning script
# ============================================================
# Target:  Hetzner CX32 (or similar), Ubuntu 24.04 LTS, fresh install
# Purpose: Install the base dev stack so you can clone the repo and
#          work on it via Claude Code CLI. Installs Node 24, Python
#          3.12, git, tmux, firewall, swap, and hardened defaults.
#
# What this script does NOT do (handled by separate steps):
#   - SSH hardening          → scripts/harden-ssh.sh   (Step 5)
#   - Tailscale install      → run manually             (Step 5)
#   - OpenClaw install       → scripts/install-openclaw.sh (Step 6)
#   - Clone the project repo → manual                   (Step 7 checklist)
#   - Put .env on disk       → manual                   (Step 7 checklist)
#
# Usage (on the VPS, as a non-root user with sudo):
#   curl -fsSL https://raw.githubusercontent.com/matteobianchin/finance/main/scripts/setup-vps.sh | bash
# OR after cloning the repo:
#   bash scripts/setup-vps.sh
#
# Idempotent: safe to re-run. Each step checks whether the work is
# already done before acting.
# ============================================================

set -euo pipefail

# Refuse to run as root — everything should land in a regular user's home.
if [[ $EUID -eq 0 ]]; then
    echo "ERROR: do not run this script as root." >&2
    echo "Create a normal user first, give them sudo, and run it as them." >&2
    exit 1
fi

# Require sudo (cached) so the user is prompted once at the top instead
# of a dozen times in the middle of the run.
if ! sudo -v; then
    echo "ERROR: this user needs sudo access." >&2
    exit 1
fi
# Keep the sudo credential fresh while the script runs.
while true; do sudo -n true; sleep 50; kill -0 "$$" || exit; done 2>/dev/null &

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m  ✓ %s\033[0m\n' "$*"; }
skip(){ printf '\033[0;33m  - %s (already done)\033[0m\n' "$*"; }

# ------------------------------------------------------------
log "Updating package index"
# ------------------------------------------------------------
sudo apt-get update -qq
ok "apt index updated"

# ------------------------------------------------------------
log "Installing base packages"
# ------------------------------------------------------------
# build-essential & python3-dev → needed by some Python wheels
# ca-certificates, curl, gnupg → needed to fetch NodeSource repo
# git, tmux, htop → baseline dev tools
# ufw, fail2ban → firewall + brute-force protection
# unattended-upgrades → automatic security updates
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    build-essential \
    ca-certificates \
    curl \
    git \
    gnupg \
    htop \
    python3 \
    python3-dev \
    python3-pip \
    python3-venv \
    tmux \
    ufw \
    fail2ban \
    unattended-upgrades
ok "base packages installed"

# ------------------------------------------------------------
log "Configuring 4 GB swap (prevents OOM under Next build / npm install)"
# ------------------------------------------------------------
if [[ -f /swapfile ]]; then
    skip "/swapfile exists"
else
    sudo fallocate -l 4G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile >/dev/null
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
    # Lower swappiness: prefer RAM, use swap only under real pressure
    echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf >/dev/null
    sudo sysctl -p /etc/sysctl.d/99-swappiness.conf >/dev/null
    ok "4 GB swap active (vm.swappiness=10)"
fi

# ------------------------------------------------------------
log "Installing Node.js 24 (required by OpenClaw and Next.js)"
# ------------------------------------------------------------
# Use NodeSource over apt's ancient Node. 24.x line is current LTS target.
if node --version 2>/dev/null | grep -q '^v24\.'; then
    skip "Node $(node --version) already installed"
else
    curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - >/dev/null
    sudo apt-get install -y -qq nodejs
    ok "Node $(node --version) installed"
fi

# Global npm prefix in $HOME to avoid needing sudo for `npm i -g`
# and keep global packages out of /usr.
if [[ ! -d "$HOME/.npm-global" ]]; then
    mkdir -p "$HOME/.npm-global"
    npm config set prefix "$HOME/.npm-global"
    ok "npm global prefix → ~/.npm-global"
else
    skip "npm global prefix already set"
fi

# ------------------------------------------------------------
log "Installing Claude Code CLI"
# ------------------------------------------------------------
if command -v claude >/dev/null 2>&1; then
    skip "claude $(claude --version 2>/dev/null || echo '') already installed"
else
    npm install -g @anthropic-ai/claude-code >/dev/null
    ok "Claude Code CLI installed (run 'claude' to login first time)"
fi

# ------------------------------------------------------------
log "Configuring ufw firewall (deny-by-default)"
# ------------------------------------------------------------
# Baseline: allow SSH (22) and reject everything else inbound.
# Tailscale traffic is handled on its own interface and bypasses ufw rules
# for connections originating from other tailnet peers (default allow).
# Explicit rule for tailscale0 added to make intent clear.
if sudo ufw status | grep -q "Status: active"; then
    skip "ufw already active"
else
    sudo ufw default deny incoming >/dev/null
    sudo ufw default allow outgoing >/dev/null
    sudo ufw allow 22/tcp comment 'SSH break-glass' >/dev/null
    sudo ufw allow in on tailscale0 comment 'Tailscale peers' >/dev/null 2>&1 || true
    sudo ufw --force enable >/dev/null
    ok "ufw enabled: 22/tcp + tailscale0 allowed, all else denied"
fi

# ------------------------------------------------------------
log "Enabling fail2ban (brute-force protection on SSH)"
# ------------------------------------------------------------
if systemctl is-active --quiet fail2ban; then
    skip "fail2ban active"
else
    sudo systemctl enable --now fail2ban >/dev/null
    ok "fail2ban enabled (defaults: ban after 5 failed SSH attempts for 10 min)"
fi

# ------------------------------------------------------------
log "Configuring unattended-upgrades (auto security patches)"
# ------------------------------------------------------------
# Write the activation file directly so the script stays non-interactive.
sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
ok "unattended-upgrades enabled (security-only by default)"

# ------------------------------------------------------------
log "Baseline shell polish (~/.bashrc additions)"
# ------------------------------------------------------------
# Only append if the marker isn't already present — keeps re-runs clean.
BASHRC="$HOME/.bashrc"
MARKER='# >>> openbb-vps-setup >>>'
if grep -q "$MARKER" "$BASHRC" 2>/dev/null; then
    skip "~/.bashrc already customized"
else
    cat >> "$BASHRC" <<'EOF'

# >>> openbb-vps-setup >>>
# History
HISTSIZE=50000
HISTFILESIZE=100000
HISTCONTROL=ignoredups:erasedups
shopt -s histappend

# Prompt with git branch
parse_git_branch() {
    git branch 2>/dev/null | sed -n 's/^\* \(.*\)/ (\1)/p'
}
PS1='\[\e[32m\]\u@\h\[\e[0m\]:\[\e[34m\]\w\[\e[35m\]$(parse_git_branch)\[\e[0m\]\$ '

# Aliases
alias ll='ls -lah --color=auto'
alias la='ls -A --color=auto'
alias gs='git status'
alias gd='git diff'
alias gp='git push'
alias gl='git log --oneline -20'

# npm-global in PATH (set earlier by setup-vps.sh)
export PATH="$HOME/.npm-global/bin:$PATH"

# Attach-or-create the dev tmux session — always run `dev` after SSH
# so closing the laptop lid never kills your work.
alias dev='tmux attach -t dev 2>/dev/null || tmux new -s dev'
# <<< openbb-vps-setup <<<
EOF
    ok "~/.bashrc customized (run 'source ~/.bashrc' or re-login to apply)"
fi

# ------------------------------------------------------------
log "Minimal ~/.tmux.conf (mouse, history, sane defaults)"
# ------------------------------------------------------------
TMUXCONF="$HOME/.tmux.conf"
if [[ -f "$TMUXCONF" ]]; then
    skip "~/.tmux.conf exists"
else
    cat > "$TMUXCONF" <<'EOF'
set -g mouse on
set -g history-limit 50000
set -g base-index 1
setw -g pane-base-index 1
set -g renumber-windows on
set -g default-terminal "screen-256color"
bind r source-file ~/.tmux.conf \; display "tmux reloaded"
EOF
    ok "~/.tmux.conf written"
fi

# ------------------------------------------------------------
log "Done. Summary:"
# ------------------------------------------------------------
printf '\n'
printf '  Node:     %s\n' "$(node --version 2>/dev/null || echo 'missing')"
printf '  npm:      %s\n' "$(npm --version 2>/dev/null || echo 'missing')"
printf '  Python:   %s\n' "$(python3 --version 2>/dev/null || echo 'missing')"
printf '  git:      %s\n' "$(git --version 2>/dev/null | cut -d' ' -f3 || echo 'missing')"
printf '  tmux:     %s\n' "$(tmux -V 2>/dev/null | cut -d' ' -f2 || echo 'missing')"
printf '  claude:   %s\n' "$(command -v claude >/dev/null && echo 'installed' || echo 'missing')"
printf '  swap:     %s\n' "$(free -h | awk '/^Swap:/ {print $2}')"
printf '  ufw:      %s\n' "$(sudo ufw status | head -1 | awk '{print $2}')"
printf '  fail2ban: %s\n' "$(systemctl is-active fail2ban)"
printf '\n'
printf '\033[1;32mBase provisioning complete.\033[0m\n'
printf '\nNext steps (in order):\n'
printf '  1. Re-login or `source ~/.bashrc` to pick up PATH and aliases.\n'
printf '  2. Install Tailscale: curl -fsSL https://tailscale.com/install.sh | sh\n'
printf '  3. Harden SSH: bash scripts/harden-ssh.sh  (after Tailscale is up)\n'
printf '  4. Install OpenClaw: bash scripts/install-openclaw.sh\n'
printf '  5. Clone the project repo under ~/ and start working.\n'
