/**
 * S3 bucket operations.
 *
 * @module buckets
 */

"use strict";

var mod_assert = require('assert-plus');
var mod_lo = require('lodash');
var mod_xmlbuilder = require('xmlbuilder');

var utils = require('./utils');
var errors = require('./errors');
var options;

function buildResult(result) {
    return mod_xmlbuilder
        .create(result, { version: '1.0', encoding: 'UTF-8'})
        .end({ pretty: options.prettyPrint });
}

function ListBuckets(req, res, next) {
    var log = req.log;
    var client = options.mantaClient;

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
                '@xmlns': 'http://s3.amazonaws.com/doc/' + options.s3Version + '/',
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

        mantaRes.once('error', function mlsBucketsErr(err) {
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

function BucketExists(bucket, req, res, next) {
    var client = options.mantaClient;

    var bucketDir = options.bucketPath + '/' + bucket;

    client.info(bucketDir, function headBucket(err) {
        if (err) {
            return next(new errors.NoSuchBucketError(bucket));
        }

        res.send(200);
        return next();
    });
}

function AddBucket(bucket, req, res, next) {
    var log = req.log;
    var client = options.mantaClient;

    var bucketDir = options.bucketPath + '/' + bucket;

    // Emulate the S3 behavior, so that we barf if a bucket is already there
    client.info(bucketDir, function infoBucket(err) {
        if (!err) {
            return next(errors.BucketAlreadyExistsError(bucket));
        }

        client.mkdirp(bucketDir, function mkdirBuckets(err) {
            next.ifError(err);

            log.debug('Adding bucket [%s]', bucket);

            res.setHeader('Location', '/' + bucket);
            res.send(200);

            return next();
        });
    });
}

function RemoveBucket(bucket, req, res, next) {
    var log = req.log;
    var client = options.mantaClient;

    var bucketDir = options.bucketPath + '/' + bucket;

    // Emulate the S3 behavior, so that we barf if a bucket is not there
    client.info(bucketDir, function infoBucket(err) {
        if (err) {
            return next(new errors.NoSuchBucketError(bucket));
        }

        // TODO: Add support for: BucketNotEmptyError

        client.rmr(bucketDir, function rmdirBuckets(err) {
            if (err) {
                log.error('Error deleting bucket directory: ' + bucketDir, err);
                err.statusCode = 500;
                err.restCode = 'InternalError';
                res.send(err);
            } else {
                log.debug('Removing bucket [%s]', bucket);
                res.send(204);
            }

            return next();
        });
    });
}

module.exports = function (_options) {
    options = _options;

    return {
        bucketExists : BucketExists,
        listBuckets: ListBuckets,
        addBucket: AddBucket,
        removeBucket: RemoveBucket
    };
};
