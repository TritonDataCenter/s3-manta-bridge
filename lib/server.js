"use strict";

var mod_assert = require('assert-plus');
var mod_restify = require('restify');

///--- Globals

var buckets = require('./buckets');
var mantaClient = require('./manta_client').client();

///--- API

function headOk(req, res, next) {
    req.log.debug("HEAD %s", req.path());
    res.send(200);
    next();
}

function BridgeServer(options) {
    var log = options.log;

    var server = mod_restify.createServer({
        name: 's3-manta-bridge',
        version: '1.0.0',
        log: log,
        formatters: {
            'application/xml' : function(req, res, body, cb ) {
                if (body instanceof Error) {
                    return body.stack;
                }

                if (Buffer.isBuffer(body)) {
                    return cb(null, body.toString('base64'));
                }

                return cb(null, body);
            }
        }
    });
    server.use(mod_restify.acceptParser(server.acceptable));
    server.use(mod_restify.queryParser());
    server.use(mod_restify.bodyParser());

    server.use(function defaultHeaders(req, res, next) {
        res.once('header', function () {
            res.setHeader('Server', 'AmazonS3');
        });
        next();
    });

    server.on('uncaughtException', function (req, res, route, err) {
        // TODO: Figure out retryable errors
//        res.send(500, { handler: 'server uncaughtException'});
        log.error(err);
    });

    /* Pass these variables in the global config so that it is universally
     * available from within all handlers. */
    server.options = options;
    server.mantaClient = mantaClient;

    // S3 GetBuckets
    server.head('/', headOk);
    server.get('/', buckets.listBuckets);

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
