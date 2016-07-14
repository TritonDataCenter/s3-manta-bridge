'use strict';

var mod_assert = require('assert-plus');
var mod_restify = require('restify');

///--- Globals

var xmlFormatter = require('./xml_formatter');
var mantaClient = require('./manta_client').client();

///--- API

function BridgeServer(options) {
    var router = require('./router')(options);
    var auth = require('./authentication')(options);

    var server = mod_restify.createServer({
        name: 's3-manta-bridge',
        version: '1.0.0',
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
        next();
    });

    /* Pass these variables in the global config so that it is universally
     * available from within all handlers. */
    server.options = options;
    server.options.mantaClient = mantaClient;

    server.head(/^.+$/, router.route);
    server.get(/^.+$/, router.route);
    server.put(/^.+$/, router.route);
    server.post(/^.+$/, router.route);
    server.del(/^.+$/, router.route);

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
