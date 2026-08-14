#!/bin/bash
set -o errexit

if [ ! -f /.dockerenv ]; then
    >&2 echo "This should be run inside Docker! See README for details."
    exit 1
fi

# Clean previous build targets
rm -rf /code/out node_modules .webpack

# Embed tracking headers directly into configuration
sed -i "s/DEV_COMMIT/$(git rev-parse --short HEAD)/" package.json
sed -i "s/DEV_BUILD_TIME/$(date)/" package.json

# Inject platform libraries needed by forge for building packages
apt-get update
apt-get install -y dpkg fakeroot

# Execute compilation pipeline
npm install
npm run make:pi