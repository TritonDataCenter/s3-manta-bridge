"use strict";

var assert = require('assert-plus');
var bunyan = require('bunyan');
var uuid = require('node-uuid');
var config = require('../../etc/config.json');

/** @type {MantaClient} */
var manta = require('../../lib/manta_client').client();

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

function startup(tape) {
    assert.object(config);

    manta.mkdirp(config.bucketPath, function (err) {
        tape.ifError(err, 'Creating bucket path: ' + config.bucketPath);
        tape.end();
    });
}

function cleanup(tape) {
    assert.object(config);
    manta.rmr(config.bucketPath, {}, function (err) {
        // do nothing

        tape.ifError(err, 'Cleaning up test Manta files: ' + config.bucketPath);
        tape.end();
    });
}

module.exports = {
    config: config,
    createLogger: createLogger,
    mantaClient: manta,
    startup: startup,
    cleanup: cleanup
};
