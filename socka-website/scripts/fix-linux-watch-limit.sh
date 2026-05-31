#!/usr/bin/env bash
set -euo pipefail

# Optional Linux fix if Vite/Astro still reports EMFILE.
# Run only if needed:
#   sudo ./scripts/fix-linux-watch-limit.sh

echo fs.inotify.max_user_watches=524288 | sudo tee /etc/sysctl.d/99-socka-watch.conf >/dev/null
echo fs.inotify.max_user_instances=1024 | sudo tee -a /etc/sysctl.d/99-socka-watch.conf >/dev/null
sudo sysctl --system
