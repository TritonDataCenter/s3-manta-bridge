FROM smebberson/alpine-base:3.0.0
MAINTAINER Elijah Zupancic <elijah@zupancic.name>

ENV TZ=utc
ENV NODE_VERSION=4.4.7

# Copy the application
RUN mkdir -p /home/app/tmp
COPY package.json /home/app/
COPY docker/usr/local/bin/proclimit.sh /usr/local/bin/proclimit.sh

RUN chmod +x /usr/local/bin/proclimit.sh \
     && apk upgrade --update \
     && apk add curl make gcc g++ linux-headers paxctl musl-dev git \
        libgcc libstdc++ binutils-gold python openssl-dev zlib-dev \
        nginx \
     && mkdir -p /root/src \
     && cd /root/src \
     && curl -sSL https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}.tar.xz > /tmp/node-v${NODE_VERSION}.tar.xz \
     && echo "1ef900b9cb3ffb617c433a3247a9d67ff36c9455cbc9c34175bee24bdbfdf731  /tmp/node-v${NODE_VERSION}.tar.xz" | sha256sum -c \
     && unxz -c /tmp/node-v${NODE_VERSION}.tar.xz | tar xf - \
     && cd /root/src/node-* \
     && ./configure --prefix=/usr --without-snapshot \
     && make -j$(grep -c ^processor /proc/cpuinfo 2>/dev/null || 1) \
     && make install \
     && paxctl -cm /usr/bin/node \
     && npm cache clean \
     && adduser -h /home/app -s /bin/sh -D app \
     && cd /home/app \
     && npm install --production \
     && npm install pm2@next -g \
     && find /home/app/node_modules/ -name \*.md -type f | xargs rm -rf $1 \
     && find /home/app/node_modules/ -name docs -or -name examples -type d | xargs rm -rf $1 \
     && apk del make gcc g++ python linux-headers git openssl-dev \
                paxctl musl-dev binutils-gold openssl-dev zlib-dev \
     && rm -rf /root/src /tmp/* /usr/share/man /var/cache/apk/* \
        /root/.npm /root/.node-gyp /usr/lib/node_modules/npm/man \
        /usr/lib/node_modules/npm/doc /usr/lib/node_modules/npm/html \
        /etc/ssl /usr/include \
        /tmp/node-v${NODE_VERSION}.tar.xz


COPY lib/ /home/app/lib
COPY etc/ /home/app/etc
COPY app.js /home/app/
COPY docker/home/app/process.yml /home/app/process.yml
COPY docker/etc/ /etc
COPY docker/usr/local/bin/load_tls_env.sh /usr/local/bin/load_tls_env.sh
COPY docker/init-wrapper /init-wrapper

RUN chown -R app:app /home/app \
    && chmod -v +x /usr/local/bin/load_tls_env.sh \
    && chmod -v +x /init-wrapper \
    && mkdir -p /etc/nginx/sites-enabled \
    && ln -s /etc/nginx/sites-available/s3-manta-bridge.conf /etc/nginx/sites-enabled/s3-manta-bridge.conf

EXPOSE 80
EXPOSE 443

ENTRYPOINT ["/init-wrapper"]
