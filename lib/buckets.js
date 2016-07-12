/**
 * @file File containing {@link Buckets} class definition.
 */
'use strict';

let mod_assert = require('assert-plus');
let mod_xmlbuilder = require('xmlbuilder');

let errors = require('./errors');

/**
 * Class providing a S3 compatible API to bucket operations that is consumable
 * by the {@link Routes} class. All methods wrap S3 calls in streaming
 * implementations.
 */
class Buckets {
    /**
     * Creates a new instance of the S3 Buckets bridge API.
     *
     * @param {object} options configuration options loaded when server is started
     * @param {string} options.bucketPath path to the Manta directory containing buckets
     * @param {string} options.s3Version S3 API version to report to client
     * @param {boolean} options.prettyPrint enable pretty printing of XML output
     * @param {external:MantaClient} mantaClient reference to Manta client instance
     */
    constructor(options, mantaClient) {
        mod_assert.ok(mantaClient, 'mantaClient');

        /**
         * Reference to Manta client instance.
         * @private
         * @type {external:MantaClient}
         */
        this._mantaClient = mantaClient;

        mod_assert.string(options.bucketPath, 'options.bucketPath');

        /**
         * Path to the Manta directory containing buckets.
         * @private
         * @type {string}
         */
        this._bucketPath = options.bucketPath;

        /**
         * S3 API version to report to client.
         * @private
         * @type {string}
         */
        this._s3Version = options.s3Version;

        /**
         * Flag togging the pretty printing of XML output.
         * @private
         * @type {boolean}
         */
        this._prettyPrintXml = options.prettyPrint;
    }

    /**
     * Receives a request via the S3 API (GET) and lists all of the available
     * buckets.
     *
     * @param {external:Request} req request object
     * @param {external:Response} res response object
     * @param {restifyCallback} next callback
     * @returns {*} callback return value
     */
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

        let self = this;
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

                let xml = self._buildResult(result);
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

                    let xml = self._buildResult(result);
                    res.send(xml);

                    return next();
                }

                log.error(err);
            });

            mantaRes.once('end', function mlsBucketsEnd(message) {
                let xml = self._buildResult(result);

                res.setHeader('x-amz-request-id', message.headers['x-request-id']);
                res.setHeader('x-request-id', message.headers['x-request-id']);
                res.setHeader('x-response-time', message.headers['x-response-time']);

                res.send(xml);
            });
        });

        return next();
    }

    /**
     * Receives a request via the S3 API (HEAD) and indicates if a given
     * bucket exists.
     *
     * @param {external:Request} req request object
     * @param {external:Response} res response object
     * @param {restifyCallback} next callback
     * @returns {*} callback return value
     */
    bucketExists(req, res, next) {
        let bucketDir = `${this._bucketPath}/${req.bucket}`;

        this._mantaClient.info(bucketDir, function headBucket(err) {
            if (err) {
                // Note: send() on 404s overwrite the code
                res.send(new errors.NoSuchBucketError(req.bucket));
                return next();
            }

            res.send(200);
            return next();
        });
    }

    /**
     * Receives a request via the S3 API (PUT) and creates a new bucket.
     *
     * @param {external:Request} req request object
     * @param {external:Response} res response object
     * @param {restifyCallback} next callback
     * @returns {*} callback return value
     */
    addBucket(req, res, next) {
        let log = req.log;
        let bucketDir = `${this._bucketPath}/${req.bucket}`;
        let mantaClient = this._mantaClient;

        // Emulate the S3 behavior, so that we barf if a bucket is already there
        mantaClient.info(bucketDir, function infoBucket(err) {
            if (!err) {
                return next(errors.BucketAlreadyExistsError(req.bucket));
            }

            mantaClient.mkdirp(bucketDir, function mkdirBuckets(err) {
                next.ifError(err);

                log.debug('Adding bucket [%s]', req.bucket);

                res.setHeader('Location', `/${req.bucket}`);
                res.send(200);

                return next();
            });
        });
    }

    /**
     * Receives a request via the S3 API (DELETE) and deletes a bucket.
     *
     * @param {external:Request} req request object
     * @param {external:Response} res response object
     * @param {restifyCallback} next callback
     * @returns {*} callback return value
     */
    removeBucket(req, res, next) {
        let log = req.log;
        let bucketDir = `${this._bucketPath}/${req.bucket}`;
        let mantaClient = this._mantaClient;

        mantaClient.info(bucketDir, function infoBucket(err) {
            if (err) {
                return next(new errors.NoSuchBucketError(req.bucket));
            }
        });

        let isMantaDirectoryEmpty = this._isMantaDirectoryEmpty.bind(this);

        /* Verify that the directory exists in Manta in order to emulate S3
         * behavior. */
        mantaClient.info(bucketDir, function infoBucket(err) {
            if (err) {
                return next(new errors.NoSuchBucketError(req.bucket));
            }

            /* S3 fails when attempting to delete a bucket that isn't empty.
             * Unfortunately, we have to go through a few contortions to make that
             * check. */
            isMantaDirectoryEmpty(bucketDir, function isEmpty(empty, err) {
                if (err) {
                    return next(new errors.InternalError(err));
                }

                if (!empty) {
                    return next(new errors.BucketNotEmptyError(req.bucket));
                }

                // Remove the underlying Manta directory that maps to bucket
                mantaClient.rmr(bucketDir, function rmdirBuckets(err) {
                    if (err) {
                        return next(new errors.InternalError(err));
                    }

                    log.debug('Removing bucket [%s]', req.bucket);
                    res.send(204);
                    return next();
                });
            });
        });
    }

    ///--- PRIVATE METHODS

    /**
     * Utility method used to create XML output from an object.
     *
     * @private
     * @param {object} result free-form object to be rendered as XML
     * @returns {string} XML string
     */
    _buildResult(result) {
        return mod_xmlbuilder
            .create(result, {version: '1.0', encoding: 'UTF-8'})
            .end({pretty: this._prettyPrintXml});
    }

    /**
     * Callback used to determine if a given Manta directory is empty.
     * @callback _isMantaDirectoryEmptyCallback
     * @param {?boolean} found flag indicating if contents were found
     * @param {Error} [err] optional error
     */

    /**
     * Method with callback that determines if a given Manta directory is
     * empty.
     *
     * @private
     * @param {string} dir Manta directory
     * @param {_isMantaDirectoryEmptyCallback} cb callback to be executed
     */
    _isMantaDirectoryEmpty(dir, cb) {
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
}

/**
 * @type {Buckets}
 */
module.exports = Buckets;
