#!/bin/bash
set -e
. /opt/supervisor-scripts/utils/logging.sh
exec /opt/instance-tools/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:3001 --logfile /var/log/portal/costage-https-tunnel.log
