/**
 * S3 Object operations
 *
 * @module objects
 */
"use strict";

var mod_assert = require('assert-plus');
var stream = require('stream');
var mod_lo = require('lodash');
var mod_path = require('path');

var errors = require('./errors');
var options;

function uploadObject(client, mantaPath, req, res, next) {
    var opts = { };

    if (req.headers['content-length']) {
        opts.size = Number(req.headers['content-length']);
    }

    if (req.headers['content-type']) {
        opts.type = req.headers['content-type'];
    }

    if (req.headers['content-md5']) {
        opts.md5 = req.headers['content-md5'];
    }

    var durability = options.defaultDurability;

    if (req.headers['x-amz-storage-class']) {
        var storageMapping = options.storageClassMappingToDurability;
        var durabilityOverride = storageMapping[req.headers['x-amz-storage-class']];

        if (durabilityOverride) {
            durability = durabilityOverride;
        }
    }

    opts.headers = {
        'x-durability-level': durability
    };

    var metadata = mod_lo.pickBy(req.headers, function filterMetadata(value, key) {
        return mod_lo.startsWith(key, 'x-amz-meta-');
    });

    mod_lo.forIn(metadata, function assignMetadata(value, key) {
        var mantaHeader = key.replace(/^x-amz-meta-/, 'm-');
        opts.headers[mantaHeader] = value;
    });

    client.put(mantaPath, req, opts, function objectPut(err, putRes) {
        if (err) {
            var internalError = new errors.InternalError(err);
            return next(internalError);
        }

        var md5base64 = putRes.headers['computed-md5'];
        var md5 = new Buffer(md5base64, 'base64').toString('hex');
        res.setHeader('ETag', '"' + md5 + '"');
        res.send(200);
        return next();
    });
}

function AddObject(bucket, req, res, next) {
    mod_assert.string(req.params[0], 'path is not present');

    var client = options.mantaClient;

    var objPath = mod_lo.trimStart(req.params[0], '/');
    var mantaPath = options.bucketPath + '/' + bucket + '/' + objPath;
    var mantaDir = mod_path.dirname(mantaPath);

    client.info(mantaDir, function headPutDir(headErr) {
        /* In order to emulate the key/value design of S3 on a hierarchical
         * filesystem, we have to parse all of the prefixing directories after
         * the bucket directory because in S3 "directories" are just part of the
         * object's key. After parsing, we just make all of the the required
         * directories on an as-needed basis. */
        if (headErr) {
            client.mkdirp(mantaDir, function mkObjDir(mkdirErr) {
                if (mkdirErr) {
                    return next(errors.InternalError(mkdirErr));
                }

                uploadObject(client, mantaPath, req, res, next);
            });
        } else {
            uploadObject(client, mantaPath, req, res, next);
        }
    });
}

function GetObject(bucket, req, res, next) {
    mod_assert.string(req.params[0], 'path is not present');

    var client = options.mantaClient;

    var objPath = mod_lo.trimStart(req.params[0], '/');
    var mantaDir = options.bucketPath + '/' + bucket;
    var mantaPath = mantaDir + '/' + objPath;

    /* We do a HEAD request against the bucket directory because it allows us
     * to simulate the check of a bucket's existence and to throw an error in a
     * way that simulates S3 behavior. */
    client.info(mantaDir, function headGetDir(headBucketErr) {
        if (headBucketErr) {
            if (headBucketErr.code === 404) {
                var noSuchBucket = new errors.NoSuchBucketError(bucket, headBucketErr);
                return next(noSuchBucket);
            }

            return next(new errors.InternalError(headBucketErr));
        }

        client.get(mantaPath, function getObj(err, stream, info) {
            if (err) {
                if (err.code === 404) {
                    res.send(404);
                    return next();
                }

                return next(new errors.InternalError(err));
            }

            if (info.headers['content-length']) {
                res.header('content-length', Number(info.headers['content-length']));            }

            if (info.headers['content-type']) {
                res.header('content-type', info.headers['content-type']);
            }

            if (info.headers['content-md5']) {
                /* S3 ETags are in a hex string format and are based on the MD5
                 * of the file. We convert Manta MD5s to a hex string in order
                 * to assure compatibility. */
                var md5base64 = info.headers['content-md5'];
                var hex = new Buffer(md5base64, 'base64').toString('hex');
                res.header('etag', hex);
            }

            if (info.headers['durability-level']) {
                var durability = info.headers['durability-level'].toString();
                var storageClass = options.durabilityMappingToStorageClass[durability] || 'STANDARD';
                res.header('x-amz-storage-class', storageClass);
            }

            var metadata = mod_lo.pickBy(info.headers, function filterMantaMetadata(value, key) {
                return mod_lo.startsWith(key, 'm-');
            });

            mod_lo.forIn(metadata, function assignMetadata(value, key) {
                var s3Header = key.replace(/^m-/, 'x-amz-meta-');
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

function DeleteObject(bucket, req, res, next) {
    mod_assert.string(req.params[0], 'path is not present');

    var client = options.mantaClient;

    var objPath = mod_lo.trimStart(req.params[0], '/');
    var mantaPath = options.bucketPath + '/' + bucket + '/' + objPath;

    client.unlink(mantaPath, function rmObj(err) {
        if (err) {
            return next(new errors.InternalError(err));
        }

        res.setHeader('x-amz-delete-marker', false);
        res.send(204);
    });
}

function ListObjects(bucket, req, res, next) {
    var client = options.mantaClient;
    var mantaDir = options.bucketPath + '/' + bucket;

    var opts = { };

    console.log(options);

    client.ftw(mantaDir, opts, function findAllInBucket(err, find) {
        mod_assert.ifError(err);

        find.on('entry', function (obj) {
            console.log(obj);
        });

        find.once('error', function (err) {
            // TODO: Select error types and emit REST codes
            return next(new errors.InternalError(err));
        });

        find.once('end', function () {
            res.send(200);
            return next();
        });
    });
}

module.exports = function (_options) {
    options = _options;

    return {
        addObject: AddObject,
        getObject: GetObject,
        deleteObject: DeleteObject,
        listObjects: ListObjects
    };
};
