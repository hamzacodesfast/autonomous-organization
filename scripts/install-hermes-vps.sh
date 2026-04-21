#!/usr/bin/env bash
set -euo pipefail

PROFILE_NAME="${1:-ao-brand}"
APP_ROOT="${APP_ROOT:-/srv/autonomous-organization/app}"
SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"
HERMES_BIN="${HERMES_BIN:-$HOME/.local/bin/hermes}"
PROFILE_DIR="${PROFILE_DIR:-$HOME/.hermes/profiles/$PROFILE_NAME}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Installing Hermes Agent if needed"
if [[ ! -x "$HERMES_BIN" ]]; then
  curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash -s -- --skip-setup
fi

export PATH="$HOME/.local/bin:$PATH"

echo "==> Creating Hermes profile: $PROFILE_NAME"
if [[ ! -d "$PROFILE_DIR" ]]; then
  "$HERMES_BIN" profile create "$PROFILE_NAME"
fi

mkdir -p "$PROFILE_DIR"

echo "==> Writing profile config and SOUL"
install -m 600 "$REPO_ROOT/deploy/hermes/ao-brand.config.yaml.example" "$PROFILE_DIR/config.yaml"
install -m 600 "$REPO_ROOT/deploy/hermes/ao-brand.SOUL.md" "$PROFILE_DIR/SOUL.md"

if [[ ! -f "$PROFILE_DIR/.env" ]]; then
  echo "==> Creating profile .env template"
  install -m 600 "$REPO_ROOT/deploy/hermes/ao-brand.env.example" "$PROFILE_DIR/.env"
fi

echo "==> Installing systemd timers"
sudo install -m 644 "$REPO_ROOT/deploy/systemd/ao-hermes-heartbeat.service" "$SYSTEMD_DIR/ao-hermes-heartbeat.service"
sudo install -m 644 "$REPO_ROOT/deploy/systemd/ao-hermes-heartbeat.timer" "$SYSTEMD_DIR/ao-hermes-heartbeat.timer"
sudo install -m 644 "$REPO_ROOT/deploy/systemd/ao-hermes-cron-tick.service" "$SYSTEMD_DIR/ao-hermes-cron-tick.service"
sudo install -m 644 "$REPO_ROOT/deploy/systemd/ao-hermes-cron-tick.timer" "$SYSTEMD_DIR/ao-hermes-cron-tick.timer"

sudo systemctl daemon-reload
sudo systemctl enable --now ao-hermes-heartbeat.timer
sudo systemctl enable --now ao-hermes-cron-tick.timer

echo "==> Hermes install complete"
echo "Profile directory: $PROFILE_DIR"
echo "Next required step: set the live model provider credentials in $PROFILE_DIR/.env"
echo "Suggested check: $HERMES_BIN -p $PROFILE_NAME profile"
