#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if [[ $EUID -eq 0 ]]; then
  echo 'Run as your normal Pi user: bash setup_pi.sh (without sudo).'
  exit 1
fi
sudo apt update
sudo apt install -y python3 python3-flask python3-serial python3-waitress unzip
if [[ ! -e config.json ]]; then
  cp config.example.json config.json
fi
mkdir -p data
chmod 700 data
if ! id -nG | tr ' ' '\n' | /usr/bin/grep -qx dialout; then
  sudo usermod -aG dialout "$(id -un)"
  echo 'Serial permission added. Reboot the Pi once before starting the hardware app.'
fi
/usr/bin/python3 -c 'import flask, serial, waitress, sqlite3; print("Python dependencies ready.")'
echo 'Next: bash start.sh'
echo 'For software practice only: bash start.sh --simulate'
