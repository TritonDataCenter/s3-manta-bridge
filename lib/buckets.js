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

function findBucketName(req, options) {
    var bucket;
    var host = utils.parseDomainFromHostWithPort(req.headers.host);

    // typically a bucket is identified by the subdomain
    var subdomain = utils.parseSubdomain(host);

    /* It is possible to use a S3 bucket outside of a subdomain. For example,
     * s3cmd supports adding buckets directly to the base subdomain. Thus, we
     * detect if the subdomain is valid and if it isn't, we fall back to
     * behavior that depends on the value of the first parsed parameter from
     * the routes. */
    var subdomainIsBucket =
        subdomain !== null &&
        subdomain.length > 1 &&
        subdomain !== options.baseSubdomain;

    if (!subdomainIsBucket) {
        if (req.params.length < 1) {
            var err = new Error('The specified bucket is not valid.');
            err.statusCode = 400;
            err.restCode = 'InvalidBucketName';
            bucket = err;
        } else {
            // Strip slashes because a bucket will never have slashes
            bucket = mod_lo.trim(req.params[0], '/');
        }
    } else {
        bucket = subdomain;
    }

    return bucket;
}

function AddBucket(req, res, next) {
    var options = this.options;
    var log = this.log;
    var client = this.mantaClient;

    var bucket = findBucketName(req, options);

    if (bucket instanceof Error) {
        var bucketErr = bucket;
        res.send(bucketErr);
        return next();
    }

    var bucketDir = options.bucketPath + '/' + bucket;

    // Emulate the S3 behavior, so that we barf if a bucket is already there
    client.info(bucketDir, function infoBucket(err) {
        if (!err) {
            var existsErr = new Error('The specified bucket is not valid.');
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

module.exports = {
    listBuckets: ListBuckets,
    addBucket: AddBucket
};
