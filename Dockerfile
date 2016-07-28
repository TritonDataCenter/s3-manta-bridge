FROM phusion/passenger-nodejs:0.9.19

ENV TZ=utc
ENV PASSENGER_COMPILE_NATIVE_SUPPORT_BINARY 0
ENV PASSENGER_DOWNLOAD_NATIVE_SUPPORT_BINARY=0

# Setup apt-get so that it doesn't warn about a non-interactive tty
RUN echo 'debconf debconf/frontend select Noninteractive' | debconf-set-selections

# Add NodeSource key and create apt sources list file for the repo
RUN curl -s https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add - && \
    echo 'deb https://deb.nodesource.com/node_4.x xenial main' > /etc/apt/sources.list.d/nodesource.list

# Upgrade and add packages
RUN apt-get update -qq && \
    apt-get purge -qq -y openssh-server openssh-client openssh-sftp-server && \
    apt-get install -qq -y python htop dc && \
    apt-get upgrade -qq -y nodejs  && \
    apt-get upgrade -qq -y -o Dpkg::Options::="--force-confold"  && \
    apt-get autoremove -qq -y

# Totally remove ssh, enable nginx, disable default nginx
RUN rm -rf /etc/service/sshd /etc/my_init.d/00_regen_ssh_host_keys.sh \
           /etc/service/nginx/down /etc/nginx/sites-enabled/default

# Copy startup setup scripts
COPY docker/etc/my_init.d/40_setup_bridge.sh /etc/my_init.d/40_setup_bridge.sh
RUN chmod +x /etc/my_init.d/40_setup_bridge.sh

# Copy the application
RUN mkdir -p /home/app/tmp
COPY lib/ /home/app/lib
COPY etc/ /home/app/etc
COPY app.js /home/app/
COPY package.json /home/app/
COPY docker/etc /etc
COPY docker/usr/local/bin/proclimit.sh /usr/local/bin/proclimit.sh

# Enable s3 Manta bridge configuration
RUN ln -v -s /etc/nginx/sites-available/s3-manta-bridge.conf /etc/nginx/sites-enabled/s3-manta-bridge.conf

# Make sure the app user owns the application home directory
RUN chown -R app:app /home/app

# Set executible bits needed for supplemental utilities
RUN chmod +x /usr/local/bin/proclimit.sh

USER app

RUN cd /home/app && \
    npm install --production

USER root

# Clean up apt and remove unneeded packages
RUN apt-get purge -qq -y python passenger-dev passenger-doc git \
                         gcc-4.8 g++-4.8 cpp-4.8 libc6-dev \
                         libstdc++-4.8-dev geoip-database linux-libc-dev \
                         python2.7-minimal build-essential && \
    apt-get autoremove -qq -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

EXPOSE 80
EXPOSE 443

# Use baseimage-docker's init process.
CMD ["/sbin/my_init"]
