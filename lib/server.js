/**
 * @file File containing Restify server startup and configuration operations.
 */
'use strict';

let mod_assert = require('assert-plus');
let mod_restify = require('restify');

///--- Globals

let xmlFormatter = require('./xml_formatter');
let MantaClientFactory = require('./manta_client');
let Routes = require('./routes');
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
 * A callback to next function in Restify rendering chain.
 * @callback restifyCallback
 * @param {*} [responseValue] return value to pass
 */

///--- API

function BridgeServer(options) {
    let mantaClient = MantaClientFactory.create(options);
    let router = new Routes(options, mantaClient);
    let auth = require('./authentication')(options);

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
        server.use(auth.authenticate);
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

    /* ES6 syntax to pass a instance method: Instance.Method.brind(instance)
     * If anyone knows a less strange way to pass this, please do that because
     * this syntax hurts the eyes and the mind. */

    server.head(/^.+$/, router.route.bind(router));
    server.get(/^.+$/, router.route.bind(router));
    server.put(/^.+$/, router.route.bind(router));
    server.post(/^.+$/, router.route.bind(router));
    server.del(/^.+$/, router.route.bind(router));

    return server;
}

function createServer(options) {
    mod_assert.object(options, 'options');
    mod_assert.object(options.log, 'options.log');

    return new BridgeServer(options);
}

module.exports = {
    createServer: createServer
};
