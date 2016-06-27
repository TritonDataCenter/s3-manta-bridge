#!/usr/bin/env bash

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

if [ -n "${TLS_CERT}" ] && [ -n "${TLS_CERT_KEY}" ]; then
  echo "Adding TLS directory"
  mkdir -p /etc/nginx/tls

  echo "Adding TLS certificate"
  echo "${TLS_CERT}" > /etc/nginx/tls/bundle.crt

  echo "Adding TLS certificate key"
  echo "${TLS_CERT_KEY}" > /etc/nginx/tls/bundle.key

  echo "Setting permissions on certificate"
  chown -R root /etc/nginx/tls
  chmod 710 /etc/nginx/tls

  echo "Enabling TLS site configuration"
  ln -s /etc/nginx/sites-available/s3-manta-bridge-tls.conf /etc/nginx/sites-enabled/s3-manta-bridge-tls.conf
else
  if [ -d /etc/nginx/tls ]; then
    echo "Removing TLS directory"
    rm -rf /etc/nginx/tls
  fi

  if [ -L /etc/nginx/sites-enabled/s3-manta-bridge-tls.conf ]; then
    echo "Disabling TLS site configuration"
    rm -f /etc/nginx/sites-enabled/s3-manta-bridge-tls.conf
  fi
fi

echo "Copying private key to app home"
mkdir -p /home/app/.ssh
echo "${MANTA_KEY_CONTENT}" > /home/app/.ssh/id_rsa
