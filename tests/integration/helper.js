"use strict";

var assert = require('assert-plus');
var bunyan = require('bunyan');
var uuid = require('node-uuid');
var config = require('../../etc/config.json');

/** @type {MantaClient} */
var manta = require('../../lib/manta_client').client();
/** @type {AWS.S3} */
var s3 = require('./s3_client')(config).client();

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

function setup(tape) {
    assert.object(config);

    manta.mkdirp(config.bucketPath, function (err) {
        tape.ifError(err, 'Creating bucket path: ' + config.bucketPath);
        tape.end();
    });
}

function teardown(tape) {
    assert.object(config);
    manta.rmr(config.bucketPath, {}, function (err) {
        // do nothing

        tape.ifError(err, 'Cleaning up test Manta files: ' + config.bucketPath);
        tape.end();
    });
}

var tape = require('tape');
var test = require('wrapping-tape')({
    setup: setup,
    teardown: teardown
});

tape.onFinish(function cleanup() {
    console.log("# onFinish");

    if (manta) {
        console.log("Closing Manta client");
        manta.close();
    }
});

module.exports = {
    config: config,
    createLogger: createLogger,
    mantaClient: manta,
    s3Client: s3,
    test: test
};
