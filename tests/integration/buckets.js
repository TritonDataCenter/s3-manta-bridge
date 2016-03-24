"use strict";

var helper = require('./helper');
var test = require('tape');
var vasync = require('vasync');
/** @type {MantaClient} */
var manta = require('../../lib/manta_client').client();
var AWS = require('aws-sdk');
var proxy = require('proxy-agent');
var once = require('once');
var uuid = require('node-uuid');
var sync = require('sync');

///--- Globals

AWS.config.update({
    httpOptions: { agent: proxy('http://localhost:8888') },
    sslEnabled: false,
    credentials: new AWS.Credentials('', '', null)
});

var s3 = new AWS.S3();

/////--- Server setup

test.onFinish(helper.cleanup);

test('setup', function(t) {
    helper.startup(function () {
        t.end();
    });
});

/////--- Tests

test('can list buckets', function (t) {
    var log = helper.createLogger(t.name);

    vasync.pipeline({
        'funcs': [
            function (_, cb) {
                log.debug("Adding test bucket");
                var bucket1 = helper.config.bucketPath + '/test-' + uuid.v4();

                manta.mkdirp(bucket1, function (err) {
                    t.ifError(err);
                });

                cb();
            },
            function () {
                setTimeout(function () {
                    s3.listBuckets(function(err, data) {
                        t.ifError(err);

                        for (var index in data.Buckets) {
                            var bucket = data.Buckets[index];
                            log.debug("Bucket: ", bucket.Name, ' : ', bucket.CreationDate);
                        }

                        t.end();
                    });
                }, 5000);

            }
        ]
    });
});
