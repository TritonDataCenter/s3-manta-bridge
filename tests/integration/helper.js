"use strict";

var assert = require('assert-plus');
var bunyan = require('bunyan');
var app = require('../../lib');
var clone = require('clone');
var uuid = require('node-uuid');
var vasync = require('vasync');
/** @type {MantaClient} */
var manta = require('../../lib/manta_client').client();

var config = {
    "serverPort": 8080,
    "prettyPrint": true,
    "bucketPath": "~~/stor/s3_bridge_test/" + uuid.v4()
};

var server;

function createLogger(name, stream) {
    var log = bunyan.createLogger({
        level: (process.env.LOG_LEVEL || 'debug'),
        name: name || process.argv[1],
        stream: stream || process.stdout,
        src: true,
        serializers: bunyan.stdSerializers
    });

    return log;
}

function createServer(cb) {
    var opts = clone(config);
    opts.log = createLogger("rest-api");

    server = app.createServer(opts);

    server.once('listening', function restifyListening() {
        opts.log.info('%s listening at %s', server.name, server.url);

        if (cb) {
            cb(server);
        }
    });

    server.listen(opts.serverPort);
}

function cleanupServer(cb) {
    server.log.info("Cleaning up server");
    if (server) {
        server.close();
    }

    if (cb) {
        cb();
    }
}

function startup(cb) {
    createServer(cb);
}

function cleanup(cb) {
    assert.object(config);
    var log = createLogger("cleanup");

    log.debug('Cleaning up test Manta files')
    manta.rmr(config.bucketPath, {}, function (err) {
        // do nothing
    });

    cleanupServer(cb);
}

module.exports = {
    config: config,
    createLogger: createLogger,
    //createClient: createClient,
    startup: createServer,
    cleanup: cleanup
};
