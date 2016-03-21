"use strict";

var assert = require('assert-plus');
var builder = require('xmlbuilder');
var client = require('./manta_client').client();

var owner = {
    ID: 'idval',
    DisplayName: client.user
};

function ListBuckets(req, res, next) {
    var options = this.options;
    var log = this.log;

    assert.object(options, 'options');
    assert.string(options.bucketPath, 'options.bucketPath');

    log.debug("Listing all buckets");

    res.header("Content-Type", "application/xml");

    client.ls(options.bucketPath, {}, function mlsBuckets(mantaError, mantaRes) {
        assert.ifError(mantaError);

        var result = {
            ListAllMyBucketsResult: {
                '@xmlns': 'http://s3.amazonaws.com/doc/2006-03-01/',
                Owner: owner,
                Buckets: []
            }
        };

        mantaRes.on('directory', function mlsBucketsDir(dir) {
            var bucket = {
                Bucket: {
                    Name: dir.name,
                    CreationDate: dir.mtime
                }
            };

            result.ListAllMyBucketsResult.Buckets.push(bucket);
        });

        mantaRes.once('error', function mlsBucketsErr(err) {
            console.error(err.stack);
            process.exit(1);
        });

        mantaRes.once('end', function mlsBucketsEnd(message) {
            var xml = builder
                .create(result, { version: '1.0', encoding: 'UTF-8'})
                .end({ pretty: options.prettyPrint });

            res.setHeader('x-amz-request-id', message.headers['x-request-id']);
            res.setHeader('x-request-id', message.headers['x-request-id']);
            res.setHeader('x-response-time', message.headers['x-response-time']);

            res.send(xml);
        });
    });

    return next();
}

module.exports = {
    listBuckets: ListBuckets
};