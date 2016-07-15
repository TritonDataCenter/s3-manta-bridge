/**
 * @file File containing {@link Objects} class definition.
 */
'use strict';

let mod_assert = require('assert-plus');
let mod_lo = require('lodash');
let mod_path = require('path');
let mod_xmlbuilder = require('xmlbuilder');

let errors = require('./errors');
let utils = require('./utils');

/**
 * Content-type returned by Manta that marks objects as a directory.
 * @type {string}
 * @default
 */
const MANTA_DIR_CONTENT_TYPE = 'application/x-json-stream; type=directory';

/**
 * Class providing an S3 compatible API that is consumable by the
 * {@link Routes} class. All methods wrap S3 calls in streaming implementations.
 */
class Objects {
    /**
     * Creates a new instance of the S3 Objects bridge API.
     *
     * @param {object} options configuration options loaded when server is started
     * @param {string} options.bucketPath path to the Manta directory containing buckets
     * @param {integer} options.defaultDurability default number of copies to make of new objects
     * @param {integer} options.maxFilenameLength maximum length of full file path
     * @param {boolean} options.prettyPrint enable pretty printing of XML output
     * @param {string} options.s3Version S3 API version to report to client
     * @param {object} options.storageClassMappingToDurability mapping of S3 storage classes to durability levels
     * @param {object} options.durabilityMappingToStorageClass mapping of durability levels to S3 storage classes
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

        /**
         * Path to the Manta directory containing buckets.
         * @private
         * @type {string}
         * @default ~~/stor/s3_buckets
         */
        this._bucketPath = options.bucketPath || '~~/stor/s3_buckets';

        /**
         * Default number of copies to make of new objects.
         * @private
         * @type {integer}
         * @default 2
         */
        this._defaultDurability = options.defaultDurability || 2;

        /**
         * Maximum length of full file path.
         * @private
         * @type {integer}
         * @default 1024
         */
        this._maxFilenameLength = options.maxFilenameLength || 1024;

        /**
         * Flag togging the pretty printing of XML output.
         * @private
         * @type {boolean}
         * @default false
         */
        this._prettyPrintXml = options.prettyPrint || false;

        /**
         * S3 API version to report to client.
         * @private
         * @type {string}
         * @default 2006-03-01
         */
        this._s3Version = options.s3Version || '2006-03-01';

        mod_assert.ok(options.storageClassMappingToDurability,
            'options.storageClassMappingToDurability');

        /**
         * Mapping of S3 storage classes to durability levels.
         * @private
         * @type {Object}
         */
        this._storageClassMappingToDurability = options.storageClassMappingToDurability;

        mod_assert.ok(options.durabilityMappingToStorageClass,
            'options.durabilityMappingToStorageClass');

        /**
         * Mapping of durability levels to S3 storage classes.
         * @private
         * @type {Object}
         */
        this._durabilityMappingToStorageClass = options.durabilityMappingToStorageClass;
    }

    ///--- PUBLIC METHODS

    /**
     * Receives a request via the S3 API (typically PUT) and streams the data
     * being sent to the Manta object store.
     *
     * @param {string} bucket S3 bucket associated with request
     * @param {external:Request} req request object
     * @param {external:Response} res response object
     * @param {restifyCallback} next callback
     */
    addObject(bucket, req, res, next) {
        mod_assert.string(req.params[0], 'path is not present');

        let objPath = mod_lo.trimStart(req.params[0], '/');
        let mantaPath = `${this._bucketPath}/${bucket}/${objPath}`;
        let mantaDir = mod_path.dirname(mantaPath);

        let self = this;

        this._mantaClient.info(mantaDir, function headPutDir(headErr) {
            /* In order to emulate the key/value design of S3 on a hierarchical
             * filesystem, we have to parse all of the prefixing directories after
             * the bucket directory because in S3 "directories" are just part of the
             * object's key. After parsing, we just make all of the the required
             * directories on an as-needed basis. */
            if (headErr) {
                self._mantaClient.mkdirp(mantaDir, function mkObjDir(mkdirErr) {
                    if (mkdirErr) {
                        return next(errors.InternalError(mkdirErr));
                    }

                    self._uploadObject(mantaPath, req, res, next);
                });
            } else {
                self._uploadObject(mantaPath, req, res, next);
            }
        });
    }

    /**
     * Receives a request via the S3 API (GET) and streams the associated object
     * from the Manta object store directly back to the requester.
     *
     * @param {string} bucket S3 bucket associated with request
     * @param {external:Request} req request object
     * @param {external:Response} res response object
     * @param {restifyCallback} next callback
     */
    getObject(bucket, req, res, next) {
        mod_assert.string(req.params[0], 'path is not present');

        let self = this;
        let mantaClient = this._mantaClient;

        let objPath = mod_lo.trimStart(req.params[0], '/');
        let mantaDir = `${this._bucketPath}/${bucket}`;
        let mantaPath = `${mantaDir}/${objPath}`;

        /* We do a HEAD request against the bucket directory because it allows us
         * to simulate the check of a bucket's existence and to throw an error in a
         * way that simulates S3 behavior. */
        mantaClient.info(mantaDir, function headGetDir(headBucketErr) {
            if (headBucketErr) {
                if (headBucketErr.statusCode === 404) {
                    let noSuchBucket = new errors.NoSuchBucketError(bucket, headBucketErr);
                    return next(noSuchBucket);
                }

                return next(new errors.InternalError(headBucketErr));
            }

            mantaClient.get(mantaPath, function getObj(err, stream, info) {
                if (err) {
                    if (err.statusCode === 404) {
                        res.send(404);
                        return next();
                    }

                    return next(new errors.InternalError(err));
                }

                if (info.headers['content-length']) {
                    res.header('content-length', Number(info.headers['content-length']));
                }

                if (info.headers['content-type']) {
                    // Don't allow downloading directories as file objects
                    if (info.headers['content-type'] === MANTA_DIR_CONTENT_TYPE) {
                        res.send(404);
                        return next();
                    }

                    res.header('content-type', info.headers['content-type']);
                }

                if (info.headers['content-md5']) {
                    /* S3 ETags are in a hex string format and are based on the MD5
                     * of the file. We convert Manta MD5s to a hex string in order
                     * to assure compatibility. */
                    let etag = Objects._md5ToEtag(info.headers['content-md5']);
                    res.header('etag', '"' + etag + '"');
                }

                if (info.headers['durability-level']) {
                    let storageClass = self._durabilityToStorageClass(
                        info.headers['durability-level']);
                    res.header('x-amz-storage-class', storageClass);
                }

                let metadata = mod_lo.pickBy(info.headers, function filterMetadata(value, key) {
                    return mod_lo.startsWith(key, 'm-');
                });

                mod_lo.forIn(metadata, function assignMetadata(value, key) {
                    let s3Header = key.replace(/^m-/, 'x-amz-meta-');
                    res.header(s3Header, value);
                });

                stream.once('end', function finishedPipingObject() {
                    res.send(200);
                    return next();
                });

                stream.pipe(res);
            });
        });
    }

    /**
     * Receives a request via the S3 API (DELETE) and deletes the associated object
     * from the Manta object store.
     *
     * @param {string} bucket S3 bucket associated with request
     * @param {external:Request} req request object
     * @param {external:Response} res response object
     * @param {restifyCallback} next callback
     */
    deleteObject(bucket, req, res, next) {
        mod_assert.string(req.params[0], 'path is not present');

        let objPath = mod_lo.trimStart(req.params[0], '/');
        let mantaPath = `${this._bucketPath}/${bucket}/${objPath}`;

        this._mantaClient.unlink(mantaPath, function rmObj(err) {
            if (err) {
                return next(new errors.InternalError(err));
            }

            res.setHeader('x-amz-delete-marker', false);
            res.send(204);
        });
    }

    /**
     * Receives a request via the S3 API (GET) and lists the directory contents
     * from the directory associated in the Manta object store.
     *
     * @param {string} bucket S3 bucket associated with request
     * @param {external:Request} req request object
     * @param {external:Response} res response object
     * @param {restifyCallback} next callback
     */
    listObjects(bucket, req, res, next) {
        let prefix = req.query.prefix || '';

        req.log.debug('Listing bucket %s/%s', bucket, prefix);

        res.header('Content-Type', 'application/xml');

        let xml = mod_xmlbuilder.create({
            ListBucketsResult: {
                '@xmlns': `http://s3.amazonaws.com/doc/${this._s3Version}/`,
                Name: bucket,
                Prefix: prefix,
                Marker: '',
                Delimiter: '/',
                MaxKeys: 1000,
                IsTruncated: false
            }
        }, { version: '1.0', encoding: 'UTF-8'});

        /* Since two sequential slashes is never a valid construct as an object
         * name in Manta, we will always return empty results for this
         */
        if (prefix.indexOf('//') > -1) {
            let xmlText = xml.end({ pretty: this._prettyPrintXml });
            res.send(xmlText);
            return next();
        }

        let prefixProps = Objects._parseSubdirAndSearchPrefix(prefix);
        let hasPrefix = prefixProps.searchPrefix.length > 0;
        let mantaDir = `${this._bucketPath}/${bucket}/${prefixProps.subdir}`;

        let opts = { };

        let self = this;

        this._mantaClient.ls(mantaDir, opts, function findAllInBucket(err, list) {
            if (err) {
                if (err.statusCode === 404) {
                    res.send(new errors.AllAccessDisabled(err));
                }

                res.send(new errors.InternalError(err));
            }

            list.on('object', function (obj) {
                let relPath = Objects._buildRelativePathForObject(bucket, obj.parent, obj.name);

                if (hasPrefix && !mod_lo.startsWith(relPath, prefixProps.searchPrefix)) {
                    return;
                }

                let contents = xml.ele('Contents');
                contents.ele('Key', {}, relPath);
                contents.ele('LastModified', {}, obj.mtime);
                contents.ele('ETag');
                contents.ele('Size', {}, obj.size);
                let owner = contents.ele('Owner', {});
                owner.ele('ID', {}, 'idval');
                owner.ele('DisplayName', {}, self._mantaClient.user);

                let storageClass = self._durabilityToStorageClass(obj.durability);
                owner.ele('StorageClass', {}, storageClass);
            });

            list.on('directory', function(dir) {
                let relPath = Objects._buildRelativePathForObject(bucket, dir.parent, dir.name);

                let commonPrefixes = xml.ele('CommonPrefixes');
                commonPrefixes.ele('Prefix', {}, relPath + '/');
            });

            list.once('error', function (err) {
                // TODO: Select error types and emit REST codes
                res.send(new errors.InternalError(err));
            });

            list.once('end', function () {
                let xmlText = xml.end({ pretty: self._prettyPrintXml });

                res.send(xmlText);
            });
        });

        return next();
    }

    /**
     * Receives a request via the S3 API (GET) and returns back XML indicating
     * the access privileges for a given object. We always return full control
     * for every object.
     *
     * @param {string} bucket S3 bucket associated with request
     * @param {external:Request} req request object
     * @param {external:Response} res response object
     * @param {restifyCallback} next callback
     */
    getAcl(bucket, req, res, next) {
        req.log.debug('Getting object ACL %s/%s', bucket, req.path());

        let owner = {
            ID: 'idval',
            DisplayName: this._mantaClient.user
        };

        let xml = mod_xmlbuilder.create({
            AccessControlPolicy: {
                '@xmlns': `http://s3.amazonaws.com/doc/${this._s3Version}/`,
                Owner: owner,
                AccessControlList: {
                    Grant: {
                        Grantee: {
                            '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                            '@xsi:type': 'CanonicalUser',
                            ID: 'idval',
                            DisplayName: this._mantaClient.user
                        },
                        Permission: 'FULL_CONTROL'
                    }
                }
            }
        }, { version: '1.0', encoding: 'UTF-8'});

        let xmlText = xml.end({ pretty: this._prettyPrintXml });

        res.header('Content-Type', 'application/xml');
        res.send(xmlText);

        return next();
    }

    /**
     * Receives a request via the S3 API (PUT) and returns a status code 200
     * for every ACL put operation. Since we don't support ACLs, we just
     * conform to the API so that there are no failures to the consumers.
     *
     * @param {string} bucket S3 bucket associated with request
     * @param {external:Request} req request object
     * @param {external:Response} res response object
     * @param {restifyCallback} next callback
     */
    putAcl(bucket, req, res, next) {
        req.log.debug('Putting object ACL (NOOP) %s/%s', bucket, req.path());

        res.send(200);
        return next();
    }

    /**
     * Receives a request via the S3 API (PUT) with the x-amz-metadata-directive
     * header set to COPY. This invokes a copy of an object. This is performed
     * internally within Manta using object links.
     *
     * @param {string} bucket S3 bucket associated with request
     * @param {external:Request} req request object
     * @param {external:Response} res response object
     * @param {restifyCallback} next callback
     */
    copyObject(bucket, req, res, next) {
        let source = utils.sanitizeS3Filepath(req.headers['x-amz-copy-source'],
            this._maxFilenameLength);

        mod_assert.string(req.params[0], 'path is not present');

        let objPath = mod_lo.trimStart(req.params[0], '/');
        let mantaPath = `${this._bucketPath}/${bucket}/${objPath}`;
        let mantaDir = mod_path.dirname(mantaPath);

        req.log.debug('Copying object from %s to %s/%s',
            source, bucket, req.path());

        let self = this;
        let fullSource = this._bucketPath + source;

        this._mantaClient.info(fullSource, function linkedObjectInfo(err, info) {
            if (err) {
                // TODO: Figure out what s3 does in this case and emulate it
                res.send(404);
            } else {
                self._mantaClient.info(mantaDir, function headLnDir(headErr) {
                    if (headErr) {
                        self._mantaClient.mkdirp(mantaDir, function mkLnObjDir(mkdirErr) {
                            if (mkdirErr) {
                                return next(errors.InternalError(mkdirErr));
                            }
                        });
                    }

                    let etag = Objects._md5ToEtag(info.headers['content-md5']);
                    let lastModified = new Date(info.headers['last-modified']).toISOString();

                    self._mantaClient.ln(fullSource, mantaPath, function objectLinked(lnErr) {
                        if (lnErr) {
                            return next(errors.InternalError(lnErr));
                        }

                        let xml = mod_xmlbuilder.create({
                            CopyObjectResult: {
                                '@xmlns': `http://s3.amazonaws.com/doc/${self._s3Version}/`
                            }
                        });

                        xml.ele('LastModified', lastModified).up()
                            .ele('ETag').raw('&quot;' + etag + '&quot;').up()
                            .end();

                        let xmlText = xml.end({pretty: self._prettyPrintXml});

                        res.header('Content-Type', 'application/xml');
                        res.send(xmlText);
                    });
                });
            }

            return next();
        });
    }

    ///--- PRIVATE METHODS

    /**
     * Looks up the S3 storage class associated with a given durability level.
     *
     * @private
     * @param {integer} durability durability level to look up against {@link this._durabilityMappingToStorageClass}
     * @returns {string} S3 storage class associated with durability level
     * @default STANDARD
     */
    _durabilityToStorageClass(durability) {
        let durabilityKey = durability ? durability.toString() :
            this._defaultDurability.toString();
        return this._durabilityMappingToStorageClass[durabilityKey] || 'STANDARD';
    }

    /**
     * Uploads data received from a Restify request object into the Manta
     * object store.
     *
     * @private
     * @param {string} mantaPath path on Manta filesystem to upload to
     * @param {string} bucket S3 bucket associated with request
     * @param {external:Request} req request object
     * @param {external:Response} res response object
     * @param {restifyCallback} next callback
     */
    _uploadObject(mantaPath, req, res, next) {
        let opts = { };

        if (req.headers['content-length']) {
            opts.size = Number(req.headers['content-length']);
        }

        if (req.headers['content-type']) {
            opts.type = req.headers['content-type'];
        }

        if (req.headers['content-md5']) {
            opts.md5 = req.headers['content-md5'];
        }

        let durability = this._defaultDurability;

        if (req.headers['x-amz-storage-class']) {
            let storageMapping = this._storageClassMappingToDurability;
            let durabilityOverride = storageMapping[req.headers['x-amz-storage-class']];

            if (durabilityOverride) {
                durability = durabilityOverride;
            }
        }

        opts.headers = {
            'x-durability-level': durability
        };

        let metadata = mod_lo.pickBy(req.headers, function filterMetadata(value, key) {
            return mod_lo.startsWith(key, 'x-amz-meta-');
        });

        mod_lo.forIn(metadata, function assignMetadata(value, key) {
            let mantaHeader = key.replace(/^x-amz-meta-/, 'm-');
            opts.headers[mantaHeader] = value;
        });

        this._mantaClient.put(mantaPath, req, opts, function objectPut(err, putRes) {
            if (err) {
                let internalError = new errors.InternalError(err);
                return next(internalError);
            }

            let etag = Objects._md5ToEtag(putRes.headers['computed-md5']);
            res.header('ETag', '"' + etag + '"');

            res.send(200);
            return next();
        });
    }

    ///--- PRIVATE STATIC METHODS

    /**
     * Breaks down a prefix into two sub parts - subdir and searchPrefix. These
     * values can be used to filter the results of a directory listing such
     * that it can conform to the prefix parameter send via the S3 API.
     *
     * @private
     * @param {string} prefix S3 prefix parameter value
     * @returns {object} subdir value and search prefix value
     */
    static _parseSubdirAndSearchPrefix(prefix) {
        if (!prefix || prefix.length === 0) {
            return {
                subdir: '',
                searchPrefix: ''
            };
        }

        let lastSlashPos = prefix.lastIndexOf('/');

        if (lastSlashPos === -1) {
            return {
                subdir: '',
                searchPrefix: prefix
            };
        }

        let hasSearchPrefix = lastSlashPos < prefix.length - 1;
        let subdir = prefix.substring(0, lastSlashPos);
        let searchPrefix = hasSearchPrefix ? prefix.substring(lastSlashPos + 1) : '';

        return {
            subdir: subdir,
            searchPrefix: searchPrefix
        };
    }

    /**
     * Determines the path of an object relative to the bucket directory path
     * on Manta in which it exists.
     *
     * @private
     * @param {string} bucket S3 bucket associated with request
     * @param {string} parent full path in Manta where the file resides
     * @param {string} name name of the file
     * @returns {string} path of the file relative to the bucket directory
     */
    static _buildRelativePathForObject(bucket, parent, name) {
        let bucketPos = parent.indexOf(bucket);
        let relDir = parent.substring(bucketPos + bucket.length + 1);

        return relDir.length > 0 ? `${relDir}/${name}` : name;
    }

    /**
     * Converts a base64 formatted md5 value to a plain-text hex value.
     *
     * @private
     * @param {string} md5base64 base64 string
     * @returns {string} hex encoded string
     */
    static _md5ToEtag(md5base64) {
        let data = new Buffer(md5base64, 'base64');
        return data.toString('hex');
    }
}

/**
 * @type {Objects}
 */
module.exports = Objects;
