"use strict";

var assert = require('assert-plus');
var restify = require('restify');
var buckets = require('./buckets');

///--- API

function BridgeServer(options) {
    var log = options.log;

    var server = restify.createServer({
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
    server.use(restify.acceptParser(server.acceptable));
    server.use(restify.queryParser());
    server.use(restify.bodyParser());

    server.use(function defaultHeaders(req, res, next) {
        res.once('header', function () {
            res.setHeader('Server', 'AmazonS3');
        });
        next();
    });

    server.on('uncaughtException', function (req, res, route, err) {
        // TODO: Figure out retryable errors
//        res.send(500, { handler: 'server uncaughtException'});
        console.error(err);
    });

    // Pass in the global config so that it is universally available from within all handlers
    server.options = options;

    // S3 GetBuckets
    server.get('/', buckets.listBuckets);

    return server;
}

function createServer(options) {
    assert.object(options, 'options');
    assert.object(options.log, 'options.log');

    return new BridgeServer(options);
}

module.exports = {
    createServer: createServer
};
