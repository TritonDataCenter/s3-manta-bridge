FROM alpine:latest
MAINTAINER Elijah Zupancic <elijah@zupancic.name>

ENV TZ=utc
ENV NODE_VERSION=4.4.7
ENV DUMB_INIT_VERSION=1.1.2

# Copy the application
RUN mkdir -p /home/app/tmp
COPY package.json /home/app/
COPY docker/usr/local/bin/proclimit.sh /usr/local/bin/proclimit.sh

RUN chmod +x /usr/local/bin/proclimit.sh \
     && apk upgrade --update \
     && apk add curl make gcc g++ linux-headers paxctl musl-dev git \
        libgcc libstdc++ binutils-gold python openssl-dev zlib-dev \
        libev-dev \
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
     && cd /root/src \
     && curl -sSL https://hitch-tls.org/source/hitch-${HITCH_VERSION}.tar.gz > /tmp/hitch-${HITCH_VERSION}.tar.gz \
     && echo "cc836bfc6d0593284d0236f004e5ee8fd5e41fc3231d81ab4b69feb7a6b4ac41  /tmp/hitch-${HITCH_VERSION}.tar.gz" | sha256sum -c \
     && tar xzf /tmp/hitch-${HITCH_VERSION}.tar.gz \
     && cd /root/src/hitch-${HITCH_VERSION} \
     && ./configure --prefix=/usr -with-rst2man=/bin/true \
     && make -j$(grep -c ^processor /proc/cpuinfo 2>/dev/null || 1) install \
     && apk del make gcc g++ python linux-headers git openssl-dev \
                paxctl musl-dev \
     && rm -rf /root/src /tmp/* /usr/share/man /var/cache/apk/* \
        /root/.npm /root/.node-gyp /usr/lib/node_modules/npm/man \
        /usr/lib/node_modules/npm/doc /usr/lib/node_modules/npm/html \
        /tmp/node-v${NODE_VERSION}.tar.xz \
        /tmp/hitch-${HITCH_VERSION}.tar.gz \
     && apk search --update \
     && curl -sSL https://github.com/Yelp/dumb-init/releases/download/v${DUMB_INIT_VERSION}/dumb-init_${DUMB_INIT_VERSION}_amd64 > /usr/local/bin/dumb-init \
     && echo 'fa3743ec2a24482932065d750fd8abb1c2cdf24f1fde54c9e6d5053822c694c0  /usr/local/bin/dumb-init' | sha256sum -c \
     && chmod +x /usr/local/bin/dumb-init

COPY lib/ /home/app/lib
COPY etc/ /home/app/etc
COPY app.js /home/app/
COPY docker/home/app/process.yml /home/app/process.yml

RUN chown -R app:app /home/app

EXPOSE 80
EXPOSE 443
EXPOSE 43554

COPY docker/start.sh /start.sh
RUN chmod 755 /start.sh
CMD ["/usr/local/bin/dumb-init", "/start.sh"]