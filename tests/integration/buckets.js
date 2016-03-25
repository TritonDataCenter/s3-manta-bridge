"use strict";

var request = require('sync-request');
var helper = require('./helper');
var vasync = require('vasync');
/** @type {MantaClient} */
var AWS = require('aws-sdk');
var proxy = require('proxy-agent');
var uuid = require('node-uuid');
var util = require('util');

var test = require('wrapping-tape')({
    setup: helper.startup,
    teardown: helper.cleanup
});

///--- Globals

var manta = helper.mantaClient;

AWS.config.update({
    httpOptions: { agent: proxy('http://localhost:8888') },
    sslEnabled: false,
    credentials: new AWS.Credentials('', '', null)
});

var s3 = new AWS.S3();

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
