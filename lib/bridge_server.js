/**
 * @file File containing {@link BridgeServer} class definition.
 */
'use strict';

let mod_assert = require('assert-plus');
let mod_restify = require('restify');
let mod_lo = require('lodash');

///--- Globals

let xmlFormatter = require('./xml_formatter');
let MantaClientFactory = require('./manta_client');
let Routes = require('./routes');
let Authenticator = require('./authenticator');
let apiVersion = require('../package.json').version;

/**
 * The Restify request object.
 * @external Request
 * @see {@link https://github.com/restify/node-restify/blob/5.x/lib/request.js}
 */

/**
 * The Restify response object.
 * @external Response
 * @see {@link https://github.com/restify/node-restify/blob/5.x/lib/response.js}
 */

/**
 * Restify server object.
 * @external Server
 * @see {@link https://github.com/restify/node-restify/blob/5.x/lib/server.js}
 */

/**
 * A callback to next function in Restify rendering chain.
 * @callback restifyCallback
 * @param {*} [responseValue] return value to pass
 */

/**
 * Class providing server startup and configuration.
 */
class BridgeServer {
    /**
     * Creates a new instance that starts up a Restify server.
     *
     * @param {Options} options runtime configuration options
     * @returns {Server}
     */
    constructor(options) {
        BridgeServer.validateOptions(options);

        let mantaClient = MantaClientFactory.create(options);
        let router = new Routes(options, mantaClient);
        let authenticator = new Authenticator(options);

        let server = mod_restify.createServer({
            name: 's3-manta-bridge',
            version: apiVersion,
            log: options.log,
            formatters: {
                'application/xml': xmlFormatter.formatter
            }
        });

        server.use(mod_restify.queryParser());
        server.use(mod_restify.acceptParser(server.acceptable));
        server.use(mod_restify.requestLogger());

        if (options.authEnabled !== false) {
            server.use(authenticator.authenticate.bind(authenticator));
        }

        server.use(function defaultHeaders(req, res, next) {
            res.once('header', function () {
                res.setHeader('Server', 'AmazonS3');
            });
            return next();
        });

        /* Pass these variables in the global config so that it is universally
         * available from within all handlers. */
        server.options = options;
        server.options.mantaClient = mantaClient;

        /* ES6 syntax to pass a instance method: Instance.Method.bind(instance)
         * If anyone knows a less strange way to pass this, please do that because
         * this syntax hurts the eyes and the mind. */

        server.head(/^.+$/, router.route.bind(router));
        server.get(/^.+$/, router.route.bind(router));
        server.put(/^.+$/, router.route.bind(router));
        server.post(/^.+$/, router.route.bind(router));
        server.del(/^.+$/, router.route.bind(router));

        return server;
    }

    /**
     * Validates that the runtime configuration options contain the required
     * configuration parameters.
     *
     * @param {Options} options runtime configuration options
     */
    static validateOptions(options) {
        mod_assert.object(options, 'options');

        if (mod_lo.isEmpty(options.accessKey)) {
            throw new Error('AWS access key is required');
        }

        if (mod_lo.isEmpty(options.secretKey)) {
            throw new Error('AWS secret key is required');
        }
    }
}

module.exports = BridgeServer;
