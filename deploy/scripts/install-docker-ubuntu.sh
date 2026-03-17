#!/usr/bin/env bash

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  SUDO="sudo"
else
  SUDO=""
fi

source /etc/os-release

case "${ID}" in
  ubuntu|debian)
    DOCKER_REPO_OS="${ID}"
    ;;
  *)
    echo "Unsupported OS: ${ID}. This script supports Debian and Ubuntu."
    exit 1
    ;;
esac

$SUDO apt-get update
$SUDO apt-get install -y ca-certificates curl gnupg
$SUDO install -m 0755 -d /etc/apt/keyrings
curl -fsSL "https://download.docker.com/linux/${DOCKER_REPO_OS}/gpg" | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg
$SUDO chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${DOCKER_REPO_OS} ${VERSION_CODENAME} stable" \
  | $SUDO tee /etc/apt/sources.list.d/docker.list >/dev/null

$SUDO apt-get update
$SUDO apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

if [[ -n "${SUDO_USER:-}" ]]; then
  $SUDO usermod -aG docker "${SUDO_USER}"
elif [[ -n "${USER:-}" ]]; then
  $SUDO usermod -aG docker "${USER}" || true
fi

echo "Docker installed. Re-login before using docker without sudo."
