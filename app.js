/**
 * @file Central entry point to s3 to Manta bridge API.
 */

'use strict';

let mod_assert = require('assert-plus');
let mod_bunyan = require('bunyan');
let mod_clone = require('clone');
let mod_gtunnel = require('global-tunnel');

///--- Globals

let Options = require('./lib/options');
let BridgeServer = require('./lib/bridge_server');

let DEFAULTS = {
    file: process.cwd() + '/etc/config.json'
};

let NAME = 's3-manta-bridge';

/**
 * Bunyan logger.
 * @external Logger
 * @see {@link https://github.com/trentm/node-bunyan/blob/master/lib/bunyan.js}
 */
let LOG = mod_bunyan.createLogger({
    name: NAME,
    level: (process.env.LOG_LEVEL || 'info'),
    stream: process.stdout
});

if (process.env.http_proxy || process.env.https_proxy) {
    LOG.info('Requests to Manta are being sent through a proxy');
    mod_gtunnel.initialize();
}

/**
 * Starts the server process and catches exit signals. 
 * 
 * @param {object} options configuration options loaded when server is started
 */
function run(options) {
    mod_assert.object(options);

    let opts = mod_clone(options);
    opts.name = NAME;

    let server = new BridgeServer(opts);
    server.listen(options.serverPort.toString(), function () {
        LOG.info('%s listening at %s', server.name, server.url);
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
    let configOptions = require(DEFAULTS.file);
    let options = new Options(configOptions);

    LOG.debug({
        config: options
    }, 'main: options and config parsed');

    run(options);
})();
