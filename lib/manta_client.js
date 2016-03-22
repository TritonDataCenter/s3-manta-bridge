"use strict";

var mod_assert = require('assert-plus');
var mod_manta = require('manta');
var mod_fs = require('fs');
var mod_bunyan = require('bunyan');
var mod_restify = require('restify');
var mod_url = require('url');

// TODO: Consume external log
var mantaLog = mod_bunyan.createLogger({
    name: 's3-manta-bridge',
    level: (process.env.LOG_LEVEL || 'info'),
    stream: process.stdout,
    serializers: mod_restify.bunyan.serializers
});

var mantaUrl;

if (process.env.MANTA_URL) {
    var url = mod_url.parse(process.env.MANTA_URL);

    /* Add in the port number if it isn't specified because if we don't set it
     * some proxies will complain. */
    if (url.protocol === 'https:' && !url.port) {
        mantaUrl = process.env.MANTA_URL + ':443';
    } else {
        mantaUrl = process.env.MANTA_URL;
    }
} else {
    mantaUrl = 'https://us-east.manta.joyent.com:443';
}

mantaLog.debug("Remote Manta host: %s", mantaUrl);

var client = mod_manta.createClient({
    sign: mod_manta.privateKeySigner({
        key: mod_fs.readFileSync(process.env.HOME + '/.ssh/id_rsa', 'utf8'),
        keyId: process.env.MANTA_KEY_ID,
        user: process.env.MANTA_USER
    }),
    log: mantaLog,
    user: process.env.MANTA_USER,
    url: mantaUrl,
    rejectUnauthorized: (process.env.MANTA_TLS_INSECURE ? false : true)
});

mod_assert.ok(client);

module.exports = {
    client: function getClient() {
        client.close();
        return client;
    }
};
