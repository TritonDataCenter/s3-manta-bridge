"use strict";

var mod_assert = require('assert-plus');
var mod_restify = require('restify');

///--- Globals

var xmlFormatter = require('./xml_formatter');
var mantaClient = require('./manta_client').client();

///--- API

function headOk(req, res, next) {
    req.log.debug("HEAD %s", req.path());
    res.send(200);
    next();
}

function BridgeServer(options) {
    var log = options.log;
    var buckets = require('./buckets')(options);

    var server = mod_restify.createServer({
        name: 's3-manta-bridge',
        version: '1.0.0',
        log: log,
        formatters: {
            'application/xml': xmlFormatter.formatter
        }
    });

    server.use(mod_restify.acceptParser(server.acceptable));
    server.use(mod_restify.requestLogger());

    server.use(function defaultHeaders(req, res, next) {
        res.once('header', function () {
            res.setHeader('Server', 'AmazonS3');
        });
        next();
    });

    //server.on('uncaughtException', function (req, res, route, err) {
    //    // TODO: Figure out retryable errors
    //    res.send(500, { handler: 'server uncaughtException'});
    //    log.error(err);
    //});

    /* Pass these variables in the global config so that it is universally
     * available from within all handlers. */
    server.options = options;
    server.options.mantaClient = mantaClient;

    // Allow HEAD to ping root for health
    server.head('/', headOk);
    // GetBuckets
    server.get('/', buckets.listBuckets);
    // PutBucket (as used by the s3cmd - added with put and path)
    server.put(/^\/+(.+)\/*$/, buckets.addBucket);
    // This is just a put operation at the base resource, the XML payload should guide us
    server.put('/', buckets.router);

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
