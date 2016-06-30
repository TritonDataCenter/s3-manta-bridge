Docker
======

A easy to use Docker image has been created for the S3 to Manta Bridge. In order
to use start up the Docker container, you will need to specify the following
environment variables to the container:

 * `MANTA_KEY_CONTENT` - The private key used to access Manta as a string 
 * `MANTA_KEY_ID` - The md5 fingerprint of the Manta public key. 
 * `MANTA_URL` - The Manta URL (eg https://us-east.manta.joyent.com)
 * `MANTA_USER` - The username of the user accessing manta
 * `AWS_ACCESS_KEY_ID` - The access key to use for S3 authentication
 * `AWS_SECRET_ACCESS_KEY` - The secret key to use for S3 authentication 
 * `TLS_CERT_KEY` - Optional TLS certificate key as a string
 * `TLS_CERT` - Optional TLS certificate

## HTTPS Support  

If either `TLS_*` variable is not present then the S3 to Manta Bridge will
operate only in non-https mode.
 
It is important to use a wildcard certificate because S3 uses subdomains to
indicate unique buckets. A self-signed certificate is fine as long as the
S3 clients connecting to the bridge can handle self-signed certificates.

## Extending

The Docker image is designed to be extensible. If you need to modify any of
the other configuration values, the `etc/config.json` configuration file
accepts interpolated environment variables. You can add an environment variable
there and then have it be passed to the node.js process by adding it to
the `/etc/nginx/main.d/manta_env.conf` configuration file.

## Docker Image Design

We opted to go with the phusion-passenger multi-process Docker base image 
because we wanted a simple way to run multiple node.js processes in a single
Docker container. This is important for this particular use cases because
there is a lot of data transfer involved in proxying an object store's API.
Event loops don't offer many advantages when your active thread is hardly ever
waiting and is busy shuffling bits as part of a file transfer. Thus, in order to
minimize the blocking of requests, we are running multiple processes.

We squash the Docker image layers by default in order to provide a smaller 
image. If you want to attempt to make use of caching and not use the squashed
image, specify the `unsquashed` label instead of latest.

## Example Run Command

If you want to startup the bridge without using docker-compose, this is what
a typical run command would look like:

```
docker run \
    -d \
    -p 80:80 -p 443:443 \
    -e MANTA_KEY_CONTENT="$(cat ~/.ssh/id_rsa)" \
    -e MANTA_KEY_ID="$MANTA_KEY_ID" \
    -e MANTA_URL="$MANTA_URL" \
    -e MANTA_USER="$MANTA_USER" \
    -e AWS_ACCESS_KEY_ID=FAKEACCESSKEYANYSTR1 \
    -e AWS_SECRET_ACCESS_KEY=anystringasasecretkeyshouldworkintheory1 \
    -e TLS_CERT_KEY="$(cat wildcard.my_domain.key)" \
    -e TLS_CERT="$(cat wildcard.my_domain.crt wildcard.my_domain_chain.crt)" \ 
    --name s3-manta-bridge \
    --rm dekobon/s3-manta-bridge:latest
```

If you are running on Joyent's Triton, adding the label `triton.cns.services=<myname>`
will allow you to do DNS load balancing against multiple instances of the bridge
running. You could then front those instances with HAProxy and add health checks
if you wanted a reliable interface or just use the DNS load balanced pool if
you did not need a great deal of reliability when a single host errors.

If you are planning running with the provided docker-compose.yml file, assuming
that you already have the Manta environment already set in your shell, typically
you would run by doing something like:
 
```
MANTA_KEY_CONTENT="$(cat ~/.ssh/id_rsa)" \
AWS_ACCESS_KEY_ID="FAKEACCESSKEYANYSTR11" \
AWS_SECRET_ACCESS_KEY="anystringasasecretkeyshouldworkintheory11" \
TLS_CERT_KEY="$(cat wildcard.triton.ws.key)" \
TLS_CERT="$(cat wildcard.triton.ws.crt wildcard.triton.ws_chain.crt)" \
docker-compose -p s3manta up -d
```

The advantage of using Docker Compose is apparent when using swarm or Joyent's
Triton because it allows you to scale with a single command:

```
MANTA_KEY_CONTENT="$(cat ~/.ssh/id_rsa)" \
AWS_ACCESS_KEY_ID="FAKEACCESSKEYANYSTR11" \
AWS_SECRET_ACCESS_KEY="anystringasasecretkeyshouldworkintheory11" \
TLS_CERT_KEY="$(cat wildcard.triton.ws.key)" \
TLS_CERT="$(cat wildcard.triton.ws.crt wildcard.triton.ws_chain.crt)" \
docker-compose -p s3manta scale s3-manta-bridge=2
```

When you are using Triton all of those instances are automatically fronted
with a domain name if you set the triton.cns.services label. Thus, you can now
see that both instances are fronted by a common domain that can be used as a CNAME
with your own domain name.

```
$ dig s3mantabridge.svc.00000000-0000-0000-0000-000000000000.us-east-3b.triton.zone
  
  ; <<>> DiG 9.9.5-3ubuntu0.8-Ubuntu <<>> s3mantabridge.svc.00000000-0000-0000-0000-000000000000.us-east-3b.triton.zone
  ;; global options: +cmd
  ;; Got answer:
  ;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 56537
  ;; flags: qr rd ra; QUERY: 1, ANSWER: 2, AUTHORITY: 0, ADDITIONAL: 1
  
  ;; OPT PSEUDOSECTION:
  ; EDNS: version: 0, flags:; udp: 4096
  ;; QUESTION SECTION:
  ;s3mantabridge.svc.00000000-0000-0000-0000-000000000000.us-east-3b.triton.zone. IN A
  
  ;; ANSWER SECTION:
  s3mantabridge.svc.00000000-0000-0000-0000-000000000000.us-east-3b.triton.zone. 30 IN A 165.225.170.76
  s3mantabridge.svc.00000000-0000-0000-0000-000000000000.us-east-3b.triton.zone. 30 IN A 165.225.168.231
  
  ;; Query time: 37 msec
  ;; SERVER: 192.168.0.1#53(192.168.0.1)
  ;; WHEN: Thu Jun 30 15:54:54 PDT 2016
  ;; MSG SIZE  rcvd: 138
```

## Domain Name Configuration

Once you have your instance up and running, you will want to associate the IP
or Triton CNS name with your own domain name. In order to be compatible with
the most common mode of S3, you will need to associate the IP/CNS name with
a subdomain wildcard and the root domain. This is important because S3 works
in both modes, so you need to have a dedicated domain for the bridge to work
in the most compatible fashion.

If you are running entirely in a localhost environment and only ever using
a single bucket, you can easily enough accomplish the same thing by editing
the /etc/hosts file and manually mapping the running IP address to both a root
domain and a subdomain + root domain.
