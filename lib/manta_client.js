"use strict";

var assert = require('assert-plus');
var manta = require('manta');
var fs = require('fs');

var client = manta.createClient({
    sign: manta.privateKeySigner({
        key: fs.readFileSync(process.env.HOME + '/.ssh/id_rsa', 'utf8'),
        keyId: process.env.MANTA_KEY_ID,
        user: process.env.MANTA_USER
    }),
    user: process.env.MANTA_USER,
    url: process.env.MANTA_URL
});
assert.ok(client);

module.exports = {
    client: function getClient() {
        return client;
    }
};