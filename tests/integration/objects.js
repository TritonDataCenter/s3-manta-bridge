"use strict";

var mod_fs = require('fs');
var mod_lo = require('lodash/util');
var mod_assert = require('assert-plus');
var mod_request = require('sync-request');
var mod_vasync = require('vasync');
var mod_uuid = require('node-uuid');
var mod_util = require('util');

///--- Globals
var helper = require('./helper');

/** @type {MantaClient} */
var manta = helper.mantaClient;
var s3 = helper.s3Client;
var test = helper.test;

/////--- Tests

test('server is alive', function (t) {
    t.plan(1);
    var port = helper.config.serverPort;
    var host = 'http://localhost:' + port;
    var res = mod_request('HEAD', host);

    t.equal(res.statusCode, 405, "Expecting server to be reachable at " + host);
    t.end();
});

test('test bucket subdomain is active', function(t) {
    var bucket = 'predictable-bucket-name';

    var port = helper.config.serverPort;
    var host = 'http://' + bucket + '.localhost:' + port;
    var res = mod_request('HEAD', host);

    /* A 404 means that we connected and it is the right status code
     * because there is no bucket at that location currently. */
    t.equal(res.statusCode, 404, "Expecting server to be reachable at " + host);
    t.end();
});

test('can add an object', function(t) {
    var bucket = 'predictable-bucket-name';
    var object = 'sample.txt';
    var filepath = '../data/' + object;

    mod_fs.readFile(filepath, function (err, data) {
        t.ifError(err, filepath + ' read without problems');
        s3.createBucket({ Bucket: bucket}, function(err) {
            t.ifError(err, 'No error when creating [' + bucket + '] bucket');

            var params = {
                Bucket: bucket,
                Key: object,
                Body: data
            };

            s3.putObject(params, function(err, data) {
                if (err) {
                    t.fail(err.message);
                }
                t.end();
            });
        });
    });
});

test('can get an object', function(t) {
    var bucket = 'predictable-bucket-name';
    var object = 'sample.txt';
    var filepath = '../data/' + object;
    var mantaDir = helper.config.bucketPath + '/' + bucket;
    var mantaPath = mantaDir + '/' + object;

    var fileStream = mod_fs.createReadStream(filepath);
    var contents = mod_fs.readFileSync(filepath, "utf8");

    manta.mkdirp(mantaDir, function(err) {
        t.ifError(err, 'Created ' + mantaDir + ' without problems');

        manta.put(mantaPath, fileStream, function (err) {
            t.ifError(err, 'Added ' + mantaPath + ' without problems');

            var params = {
                Bucket: bucket,
                Key: object
            };

            s3.getObject(params, function(err, data) {
                t.ifError(err, 'Got object ' + mantaPath + ' via the S3 API with errors');

                t.ok(data, 'S3 response present');
                var actualContents = data.Body.toString();
                t.equal(actualContents, contents, 'File contents are as expected');
            });
        });

        fileStream.close();
        t.end();
    });
});
