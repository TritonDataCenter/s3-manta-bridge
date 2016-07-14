/**
 * S3 bucket operations.
 *
 * @class Buckets
 */

'use strict';

let mod_assert = require('assert-plus');
let mod_xmlbuilder = require('xmlbuilder');

let errors = require('./errors');

module.exports = class Buckets {
    constructor(options, mantaClient) {
        mod_assert.ok(mantaClient, 'mantaClient');
        this._mantaClient = mantaClient;

        mod_assert.string(options.bucketPath, 'options.bucketPath');
        this._bucketPath = options.bucketPath;

        this._s3Version = options.s3Version || '2006-03-01';
        this._prettyPrintXml = options.prettyPrint || false;
    }

    _buildResult(result) {
        return mod_xmlbuilder
            .create(result, {version: '1.0', encoding: 'UTF-8'})
            .end({pretty: this._prettyPrintXml});
    }

    listBuckets(req, res, next) {
        let log = req.log;

        log.debug('Listing all buckets');

        res.header('Content-Type', 'application/xml');

        let owner = {
            ID: 'idval',
            DisplayName: this._mantaClient.user
        };

        let emptyErrorCodes = [
            'NotFoundError',
            'DirectoryDoesNotExistError',
            'ResourceNotFoundError'
        ];

        let buildResult = this._buildResult.bind(this);
        let bucketPath = this._bucketPath;

        this._mantaClient.ls(this._bucketPath, function mlsBuckets(err, mantaRes) {
            let result = {
                ListAllMyBucketsResult: {
                    '@xmlns': `http://s3.amazonaws.com/doc/${this._s3Version}/`,
                    Owner: owner,
                    Buckets: {}
                }
            };

            if (err && emptyErrorCodes.indexOf(err.code) > -1) {
                log.debug('No buckets found at path: %s', bucketPath);

                let xml = this._buildResult(result);
                res.send(xml);

                return next();
            }

            mod_assert.ifError(err);

            mantaRes.on('directory', function mlsBucketsDir(dir) {
                let bucket = {
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
                    log.debug('No buckets found at path: %s', bucketPath);

                    let xml = this._buildResult(result);
                    res.send(xml);

                    return next();
                }

                log.error(err);
            });

            mantaRes.once('end', function mlsBucketsEnd(message) {
                let xml = buildResult(result);

                res.setHeader('x-amz-request-id', message.headers['x-request-id']);
                res.setHeader('x-request-id', message.headers['x-request-id']);
                res.setHeader('x-response-time', message.headers['x-response-time']);

                res.send(xml);
            });
        });

        return next();
    }

    bucketExists(bucket, req, res, next) {
        let bucketDir = `${this._bucketPath}/${bucket}`;

        this._mantaClient.info(bucketDir, function headBucket(err) {
            if (err) {
                // Note: send() on 404s overwrite the code
                res.send(new errors.NoSuchBucketError(bucket));
                return next();
            }

            res.send(200);
            return next();
        });
    }

    addBucket(bucket, req, res, next) {
        let log = req.log;
        let bucketDir = `${this._bucketPath}/${bucket}`;
        let mantaClient = this._mantaClient;

        // Emulate the S3 behavior, so that we barf if a bucket is already there
        mantaClient.info(bucketDir, function infoBucket(err) {
            if (!err) {
                return next(errors.BucketAlreadyExistsError(bucket));
            }

            mantaClient.mkdirp(bucketDir, function mkdirBuckets(err) {
                next.ifError(err);

                log.debug('Adding bucket [%s]', bucket);

                res.setHeader('Location', `/${bucket}`);
                res.send(200);

                return next();
            });
        });
    }

    isMantaDirectoryEmpty(dir, cb) {
        this._mantaClient.ls(dir, {}, function checkForEmptyDir(err, res) {
            let done = false;
            let found = false;

            if (err) {
                done = true;
                cb(null, err);
            }

            res.on('error', function errorOnListing(err) {
                done = true;
                res.emit('end');
                cb(null, err);
            });

            res.once('object', function objFound() {
                found = true;
                res.emit('end');
            });

            res.once('directory', function dirFound() {
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

    removeBucket(bucket, req, res, next) {
        let log = req.log;
        let bucketDir = `${this._bucketPath}/${bucket}`;
        let mantaClient = this._mantaClient;

        mantaClient.info(bucketDir, function infoBucket(err) {
            if (err) {
                return next(new errors.NoSuchBucketError(bucket));
            }
        });

        let isMantaDirectoryEmpty = this.isMantaDirectoryEmpty.bind(this);

        /* Verify that the directory exists in Manta in order to emulate S3
         * behavior. */
        mantaClient.info(bucketDir, function infoBucket(err) {
            if (err) {
                return next(new errors.NoSuchBucketError(bucket));
            }

            /* S3 fails when attempting to delete a bucket that isn't empty.
             * Unfortunately, we have to go through a few contortions to make that
             * check. */
            isMantaDirectoryEmpty(bucketDir, function isEmpty(empty, err) {
                if (err) {
                    return next(new errors.InternalError(err));
                }

                if (!empty) {
                    return next(new errors.BucketNotEmptyError(bucket));
                }

                // Remove the underlying Manta directory that maps to bucket
                mantaClient.rmr(bucketDir, function rmdirBuckets(err) {
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
};
