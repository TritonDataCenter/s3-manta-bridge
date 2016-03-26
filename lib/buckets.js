"use strict";

var mod_assert = require('assert-plus');
var mod_xmlbuilder = require('xmlbuilder');

function buildResult(result, options) {
    return mod_xmlbuilder
        .create(result, { version: '1.0', encoding: 'UTF-8'})
        .end({ pretty: options.prettyPrint });
}

function ListBuckets(req, res, next) {
    var options = this.options;
    var log = this.log;
    var client = this.mantaClient;

    mod_assert.object(options, 'options');
    mod_assert.string(options.bucketPath, 'options.bucketPath');

    log.debug("Listing all buckets");

    res.header("Content-Type", "application/xml");

    var owner = {
        ID: 'idval',
        DisplayName: client.user
    };

    var emptyErrorCodes = [
        'NotFoundError',
        'DirectoryDoesNotExistError',
        'ResourceNotFoundError'
    ];

    client.ls(options.bucketPath, function mlsBuckets(err, mantaRes) {
        var result = {
            ListAllMyBucketsResult: {
                '@xmlns': 'http://s3.amazonaws.com/doc/2006-03-01/',
                Owner: owner,
                Buckets: {}
            }
        };

        if (err && emptyErrorCodes.indexOf(err.code) > -1) {
            log.debug("No buckets found at path: %s", options.bucketPath);

            var xml = buildResult(result, options);
            res.send(xml);

            return next();
        }

        mod_assert.ifError(err);

        mantaRes.on('directory', function mlsBucketsDir(dir) {
            var bucket = {
                Name: dir.name,
                CreationDate: dir.mtime
            };

            if (!result.ListAllMyBucketsResult.Buckets.Bucket) {
                result.ListAllMyBucketsResult.Buckets.Bucket = [];
            }

            result.ListAllMyBucketsResult.Buckets.Bucket.push(bucket);
        });

        mantaRes.once('error', function mlsBucketsErr(err, _) {
            if (err && emptyErrorCodes.indexOf(err.code) > -1) {
                log.debug("No buckets found at path: %s", options.bucketPath);

                var xml = buildResult(result, options);
                res.send(xml);

                return next();
            }

            log.error(err);
        });

        mantaRes.once('end', function mlsBucketsEnd(message) {
            var xml = buildResult(result, options);

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
