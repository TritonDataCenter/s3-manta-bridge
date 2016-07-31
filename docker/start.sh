#!/usr/bin/env sh

if [ -z "${MANTA_KEY_CONTENT}" ]; then
  >&2 echo "MANTA_KEY_CONTENT must be set"
  exit 1
fi

if [ -z "${MANTA_KEY_ID}" ]; then
  >&2 echo "MANTA_KEY_ID must be set"
  exit 1
fi

if [ -z "${MANTA_URL}" ]; then
  >&2 echo "MANTA_URL must be set"
  exit 1
fi

if [ -z "${MANTA_USER}" ]; then
  >&2 echo "MANTA_USER must be set"
  exit 1
fi

if [ -z "${AWS_ACCESS_KEY_ID}" ]; then
  >&2 echo "AWS_ACCESS_KEY_ID must be set"
  exit 1
fi

if [ -z "${AWS_SECRET_ACCESS_KEY}" ]; then
  >&2 echo "AWS_SECRET_ACCESS_KEY must be set"
  exit 1
fi

echo "Copying private key to app home"
mkdir -p /home/app/.ssh
echo "${MANTA_KEY_CONTENT}" > /home/app/.ssh/id_rsa

echo "Setting process limit variables"
# The output of proclimit is very conservative, so we increase it by 4
if [ -d "/native" ]; then
    export PROC_LIMIT="`echo 4 $(/usr/local/bin/proclimit.sh) + p | dc`"
else
    export PROC_LIMIT="$(grep -c ^processor /proc/cpuinfo 2>/dev/null || 1)"
fi

cd /home/app
HOME=/home/app exec pm2-docker start process.yml --json-logs bunyan