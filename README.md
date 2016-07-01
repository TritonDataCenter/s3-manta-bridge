# S3 Manta Bridge

This project allows you to use the S3 API to perform operations against a Manta object store.

This project is still under active development. If you would like to contribute,
please tweet: @shitsukoisaru

## Docker

To start up Docker:

```
docker run -it -p 9090:80 -e MANTA_KEY_CONTENT="$(cat ~/.ssh/id_rsa)" -e MANTA_KEY_ID="$MANTA_KEY_ID" -e MANTA_URL="$MANTA_URL" -e MANTA_USER="$MANTA_USER" --name s3-manta-bridge --rm dekobon/s3-manta-bridge
```
