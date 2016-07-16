'use strict';

let mod_assert = require('assert-plus');
let mod_lo = require('lodash');
let mod_manta = require('manta');
let mod_fs = require('fs');
let mod_bunyan = require('bunyan');
let mod_restify = require('restify');
let mod_url = require('url');

/**
 * The Manta client object.
 * @external MantaClient
 * @see {@link https://github.com/joyent/node-manta/blob/master/lib/client.js}
 */

module.exports = class MantaClientFactory {
    static _findPrivateKey(options) {
        let privateKeyPath;

        if (mod_lo.isEmpty(options.manta.privateKeyPath)) {
            privateKeyPath = `${process.env.HOME}/.ssh/id_rsa`;
        } else {
            privateKeyPath = options.manta.privateKeyPath;
        }

        let privateKey =  mod_fs.readFileSync(privateKeyPath, 'utf8');
        mod_assert.ok(privateKey, 'private key contents');

        return privateKey;
    }

    static _findMantaUrl(options) {
        let url = options.manta.url;
        let parsedMantaUrl = mod_url.parse(url);

        /* Add in the port number if it isn't specified because if we don't set it
         * some proxies will complain. */
        if (parsedMantaUrl.protocol === 'https:' && !parsedMantaUrl.port) {
            return `${url}:443`;
        } else {
            return url;
        }
    }

    static _isRejectUnauthorizedEnabled(options) {
        if (!mod_lo.isEmpty(options.manta.insecure)) {
            mod_assert.isBoolean(options.manta.insecure);
            return !options.manta.insecure;
        } else {
            return true;
        }
    }

    static create(options) {
        // TODO: Consume external log
        let mantaLog = mod_bunyan.createLogger({
            name: 's3-manta-bridge',
            level: (process.env.LOG_LEVEL || 'info'),
            stream: process.stdout,
            serializers: mod_restify.bunyan.serializers
        });

        if (!options.manta.user) {
            throw new Error('Manta username must be set');
        }

        if (!options.manta.keyId) {
            throw new Error('Manta key id must be set');
        }

        let mantaUrl = MantaClientFactory._findMantaUrl(options);
        mantaLog.debug('Remote Manta host: %s', mantaUrl);

        let rejectUnauthorized = MantaClientFactory._isRejectUnauthorizedEnabled(options);

        let params = {
            sign: mod_manta.privateKeySigner({
                key: MantaClientFactory._findPrivateKey(options),
                keyId: options.manta.keyId,
                user: options.manta.user
            }),
            log: mantaLog,
            user: options.manta.user,
            url: mantaUrl,
            rejectUnauthorized: rejectUnauthorized
        };

        if (!mod_lo.isEmpty(options.manta.subuser)) {
            params.subuser = options.manta.subuser;
        }

        if (!mod_lo.isEmpty(options.manta.role)) {
            params.role = options.manta.role;
        }

        if (!mod_lo.isEmpty(options.manta.connectTimeout)) {
            params.connectTimeout = options.manta.connectTimeout;
        }

        let client = mod_manta.createClient(params);

        mod_assert.ok(client);

        return client;
    }
};
