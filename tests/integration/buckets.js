"use strict";

var request = require('sync-request');
var helper = require('./helper');
var vasync = require('vasync');
var uuid = require('node-uuid');
var util = require('util');

///--- Globals

/** @type {MantaClient} */
var manta = helper.mantaClient;
var s3 = helper.s3Client;
var test = helper.test;

/////--- Tests

test('server is alive', function (t) {
    t.plan(1);
    var port = helper.config.serverPort;
    var host = 'http://localhost:' + port;
    var res = request('HEAD', host);

    t.equal(res.statusCode, 200, "Expecting server to be reachable at " + host);
});

test('can list buckets - no buckets', function (t) {
    t.plan(2);

    s3.listBuckets(function(err, data) {
        t.ifError(err, 'Expecting S3 buckets list call to succeed');

        var buckets = data.Buckets;
        t.equal(buckets.length, 0, 'Expecting no buckets to return');
    });
});

test('can list buckets - one bucket', function (t) {
    var newBucket = 'test-' + uuid.v4();
    var newBucketPath = helper.config.bucketPath + '/' + newBucket;

    vasync.pipeline({
        'funcs': [
            function (_, next) {
                manta.mkdirp(newBucketPath, function (err) {
                    t.ifError(err, 'Expecting mkdirp to succeed for ' + newBucket);
                    next();
                });
            },
            function (_) {
                s3.listBuckets(function (err, data) {
                    t.ifError(err, 'Expecting S3 buckets list call to succeed');

                    var buckets = data.Buckets;
                    t.equal(buckets.length, 1, 'Only a single bucket expected');
                    t.equal(buckets[0].Name, newBucket, 'Bucket is named: ' + newBucket);
                    t.end();
                });
            }
        ]
    });
});
