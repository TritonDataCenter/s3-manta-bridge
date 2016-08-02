#!/usr/bin/env sh

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
  ln -sf /etc/nginx/sites-available/s3-manta-bridge-tls.conf /etc/nginx/sites-enabled/s3-manta-bridge-tls.conf
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
