#!/bin/bash
set -e
# Use the Vast environment/logging helpers when available; keep this app private.
if [ -f /opt/supervisor-scripts/utils/logging.sh ]; then
  . /opt/supervisor-scripts/utils/logging.sh
  . /opt/supervisor-scripts/utils/environment.sh
fi
if [ -f /opt/nvm/nvm.sh ]; then
  . /opt/nvm/nvm.sh
fi
cd /costage
export HOST=127.0.0.1 PORT=3001
exec node dist/apps/server/src/index.js
