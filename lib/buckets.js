/**
 * S3 bucket operations.
 *
 * @module buckets
 */

"use strict";

var mod_assert = require('assert-plus');
var mod_vasync = require('vasync');
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
            // Note: send() on 404s overwrite the code
            res.send(new errors.NoSuchBucketError(bucket));
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

function isMantaDirectoryEmpty(dir, options, cb) {
    var client = options.mantaClient;

    client.ls(dir, {}, function checkForEmptyDir(err, res) {
        var done = false;
        var found = false;

        if (err) {
            done = true;
            cb(null, err);
        }

        res.on('error', function errorOnListing(err) {
            done = true;
            res.emit('end');
            cb(null, err);
        });

        res.once('object', function objFound(obj) {
            found = true;
            res.emit('end');
        });

        res.once('directory', function dirFound(dir) {
            found = true;
            res.emit('end');
        });

        res.once('end', function finishedDeadList() {
            if (!done) {
                cb(!found);
                done = true;
            }
        });
    });
}

function RemoveBucket(bucket, req, res, next) {
    var log = req.log;
    var client = options.mantaClient;

    var bucketDir = options.bucketPath + '/' + bucket;

    client.info(bucketDir, function infoBucket(err) {
        if (err) {
            return next(new errors.NoSuchBucketError(bucket));
        }
    });

    /* Verify that the directory exists in Manta in order to emulate S3
     * behavior. */
    client.info(bucketDir, function infoBucket(err) {
        if (err) {
            return next(new errors.NoSuchBucketError(bucket));
        }

        /* S3 fails when attempting to delete a bucket that isn't empty.
         * Unfortunately, we have to go through a few contortions to make that
         * check. */
        isMantaDirectoryEmpty(bucketDir, options, function isEmpty(empty, err) {
            if (err) {
                return next(new errors.InternalError(err));
            }

            if (!empty) {
                return next(new errors.BucketNotEmptyError(bucket));
            }

            // Remove the underlying Manta directory that maps to bucket
            client.rmr(bucketDir, function rmdirBuckets(err) {
                if (err) {
                    return next(new errors.InternalError(err));
                }

                log.debug('Removing bucket [%s]', bucket);
                res.send(204);
                return next();
            });
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
