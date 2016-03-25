"use strict";

var assert = require('assert-plus');
var manta = require('manta');
var fs = require('fs');
var bunyan = require('bunyan');
var restify = require('restify');

var mantaLog = bunyan.createLogger({
    name: 's3-manta-bridge',
    level: (process.env.LOG_LEVEL || 'info'),
    stream: process.stdout,
    serializers: restify.bunyan.serializers
});

var client = manta.createClient({
    sign: manta.privateKeySigner({
        key: fs.readFileSync(process.env.HOME + '/.ssh/id_rsa', 'utf8'),
        keyId: process.env.MANTA_KEY_ID,
        user: process.env.MANTA_USER
    }),
    log: mantaLog,
    user: process.env.MANTA_USER,
    url: process.env.MANTA_URL || 'https://us-east.manta.joyent.com:443',
    rejectUnauthorized: (process.env.MANTA_TLS_INSECURE ? false : true),

});
assert.ok(client);

module.exports = {
    client: function getClient() {
        return client;
    }
};
