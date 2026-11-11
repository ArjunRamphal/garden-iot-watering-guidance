#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if [[ $EUID -eq 0 ]]; then
  echo 'Run without sudo as your normal Pi user.'
  exit 1
fi
project_dir=$(pwd -P)
task_user=$(id -un)
# Keep the generated systemd unit straightforward and inspectable.
if [[ "$project_dir" =~ [^a-zA-Z0-9_./-] ]]; then
  echo 'Move this project to a path without spaces or special characters first.'
  exit 1
fi
if [[ ! -f config.json ]]; then
  echo 'Run setup_pi.sh and test the app first.'
  exit 1
fi
unit_file=$(mktemp)
trap 'rm -f "$unit_file"' EXIT
cat > "$unit_file" <<EOF
[Unit]
Description=COMP717A soil moisture monitoring
After=network.target

[Service]
Type=simple
User=$task_user
SupplementaryGroups=dialout
WorkingDirectory=$project_dir
ExecStart=/usr/bin/python3 $project_dir/app.py
Restart=on-failure
RestartSec=5
UMask=0077

[Install]
WantedBy=multi-user.target
EOF
sudo install -m 644 "$unit_file" /etc/systemd/system/comp717a-garden.service
sudo systemctl daemon-reload
sudo systemctl enable --now comp717a-garden.service
echo 'Service installed. Status: systemctl status comp717a-garden.service'
echo 'Logs: journalctl -u comp717a-garden.service -n 50 --no-pager'
