"use strict";

var bunyan = require('bunyan');
var app = require('../../lib');
var config = require(process.cwd() + '/etc/config.json');
var clone = require('clone');

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
    server.listen(opts.serverPort, function () {
        opts.log.info('%s listening at %s', server.name, server.url);
        cb();
    });
}

function cleanupServer(cb) {
    if (server) {
        server.close();
    } else {
        cb();
    }
}

module.exports = {
    createLogger: createLogger,
    //createClient: createClient,
    createServer: createServer,
    cleanupServer: cleanupServer
};
