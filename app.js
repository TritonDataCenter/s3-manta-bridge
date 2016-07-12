/**
 * Central entry point to s3 to Manta bridge API.
 *
 * @module app
 */

"use strict";

var mod_assert = require('assert-plus');
var mod_bunyan = require('bunyan');
var mod_clone = require('clone');
var mod_gtunnel = require('global-tunnel');
var mod_lo = require('lodash');
var mod_resolve_env = require('resolve-env');

///--- Globals

var app = require('./lib');

var DEFAULTS = {
    file: process.cwd() + '/etc/config.json',
    port: 80
};

var NAME = 's3-manta-bridge';

var LOG = mod_bunyan.createLogger({
    name: NAME,
    level: (process.env.LOG_LEVEL || 'info'),
    stream: process.stdout
});

if (process.env.http_proxy || process.env.https_proxy) {
    LOG.info("Requests to Manta are being sent through a proxy");
    mod_gtunnel.initialize();
}

function run(options) {
    mod_assert.object(options);

    var opts = mod_clone(options);
    opts.log = LOG;
    opts.name = NAME;

    var server = app.createServer(opts);
    server.listen(options.serverPort.toString(), function () {
        opts.log.info('%s listening at %s', server.name, server.url);
    });

    function shutdown(cb) {
        server.close(function () {
            server.log.debug('Closing Manta client');
            server.options.mantaClient.close();
            server.log.debug('Closing Restify');

            if (cb) {
                cb();
            }

            process.exit(0);
        });
    }

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    process.once('SIGUSR2', function () {
        shutdown(function () {
            process.kill(process.pid, 'SIGUSR2');
        });
    });
}

///--- Mainline

(function main() {
    var config = require(DEFAULTS.file);

    // We interpolate each configuration value with user-specified env vars
    mod_lo.forOwn(config, function interpolateEnv(v, k) {
        if (mod_lo.isString(v)) {
            config[k] = mod_lo.trim(mod_resolve_env(v));
        }
    });

    LOG.debug({
        config: config
    }, 'main: options and config parsed');

    run(config);
})();
