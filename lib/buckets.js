/**
 * S3 bucket operations.
 *
 * @module buckets
 */

"use strict";

var mod_assert = require('assert-plus');
var mod_lo = require('lodash');
var mod_xmlbuilder = require('xmlbuilder');
var mod_xmlstream = require('xml-stream');

var utils = require('./utils');
var options;

/**
 * When an XML operation is made to the base of a bucket, this method is
 * responsible for routing it to the correct suboperation.
 *
 * @param req Request from HTTP client
 * @param res Response to HTTP client
 * @param next next call back
 */
function BucketBaseRouter(req, res, next) {
        var parser = new mod_xmlstream(req, 'utf8');

        parser.once('startElement: CreateBucketConfiguration', function() {
            /* We explicitly stop parsing the stream after we get the opening tag
             * so that we don't have to parse more data than needed. */
            AddBucket(req, res, function() {
                parser.emit('end');
                next();
            });
        });

        // TODO: Add request size checking

        parser.on('end', function() {
            return next();
        });
}

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
            var existsErr = new Error('The specified bucket does not exist');
            existsErr.statusCode = 404;
            existsErr.restCode = 'NoSuchBucket';
            res.send(existsErr);
            return next();
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
            var existsErr = new Error('The specified bucket is not valid');
            existsErr.statusCode = 409;
            existsErr.restCode = 'BucketAlreadyExists';
            res.send(existsErr);
            return next();
        }

        client.mkdirp(bucketDir, function mkdirBuckets(err) {
            if (err) {
                log.error('Error creating bucket directory: ' + bucketDir, err);
                err.statusCode = 500;
                err.restCode = 'InternalError';
                res.send(err);
            } else {
                log.debug('Adding bucket [%s]', bucket);

                res.setHeader('Location', '/' + bucket);
                res.send(200);
            }

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
            var existsErr = new Error('The specified bucket does not exist');
            existsErr.statusCode = 404;
            existsErr.restCode = 'NoSuchBucket';
            res.send(existsErr);
            return next();
        }

        // TODO: Add support for: BucketNotEmpty

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
        router: BucketBaseRouter,
        bucketExists : BucketExists,
        listBuckets: ListBuckets,
        addBucket: AddBucket,
        removeBucket: RemoveBucket
    };
};
