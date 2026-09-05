#!/bin/bash
set -e
. /opt/supervisor-scripts/utils/logging.sh
exec /opt/instance-tools/bin/caddy run --config /costage/deployment/Caddyfile.public --adapter caddyfile
