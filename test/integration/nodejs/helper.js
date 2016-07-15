'use strict';

let assert = require('assert-plus');
let bunyan = require('bunyan');
let options = require('../../../etc/config.json');
let utils = require('../../../lib/utils');
let MantaClientFactory = require('../../../lib/manta_client');

// We interpolate each configuration value with user-specified env vars
utils.interpolateEnvVars(options);

/** @type {MantaClient} */
let manta = MantaClientFactory.create(options);

/** @type {AWS.S3} */
let s3 = require('./s3_client')(options).client();

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
    assert.object(options);

    manta.mkdirp(options.bucketPath, function (err) {
        tape.ifError(err, 'Creating bucket path: ' + options.bucketPath);
        tape.end();
    });
}

function teardown(tape) {
    assert.object(options);
    manta.rmr(options.bucketPath, {}, function (err) {
        /* Sometimes when you are on a flaky connection (like a tethered
         * mobile phone), there are a lot of connection timeouts on test cleanup
         * operations. Below, we give the client another chance to execute the
         * cleanup operation. */
        if (err && err.name === 'ConnectTimeoutError') {
            manta.rmr(options.bucketPath, {}, function retryRm(err) {
                tape.ifError(err, 'Successful retry for cleaning up test Manta files: ' +
                    options.bucketPath);
                tape.end();
            });
        // If everything goes right, we land here
        } else {
            tape.ifError(err, `Cleaning up test Manta files: ${options.bucketPath}`);
            tape.end();
        }
    });
}

let tape = require('tape');
let test = require('wrapping-tape')({
    setup: setup,
    teardown: teardown
});

tape.onFinish(function cleanup() {
    /* eslint-disable no-console */
    console.log('# onFinish');

    if (manta) {
        console.log('Closing Manta client');
        manta.close();
    }
    /* eslint-enable no-console */
});

module.exports = {
    config: options,
    createLogger: createLogger,
    mantaClient: manta,
    s3Client: s3,
    test: test
};
