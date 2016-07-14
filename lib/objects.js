/**
 * S3 Object operations
 *
 * @module objects
 */
'use strict';

var mod_assert = require('assert-plus');
var mod_lo = require('lodash');
var mod_path = require('path');
var mod_xmlbuilder = require('xmlbuilder');

var errors = require('./errors');
var utils = require('./utils');
var options;

const MANTA_DIR_CONTENT_TYPE = 'application/x-json-stream; type=directory';

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

        var etag = md5ToEtag(putRes.headers['computed-md5']);
        res.header('ETag', '"' + etag + '"');

        res.send(200);
        return next();
    });
}

function md5ToEtag(md5base64) {
    var data = new Buffer(md5base64, 'base64');
    return data.toString('hex');
}

function durabilityToStorageClass(durability) {
    var durabilityKey = durability ? durability.toString() :
        options.defaultDurability.toString();
    return options.durabilityMappingToStorageClass[durabilityKey] || 'STANDARD';
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
            if (headBucketErr.statusCode === 404) {
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
                res.header('content-length', Number(info.headers['content-length']));
            }

            if (info.headers['content-type']) {
                // Don't allow downloading directories as file objects
                if (info.headers['content-type'] === MANTA_DIR_CONTENT_TYPE) {
                    return next(new errors.NotFoundError());
                }

                res.header('content-type', info.headers['content-type']);
            }

            if (info.headers['content-md5']) {
                /* S3 ETags are in a hex string format and are based on the MD5
                 * of the file. We convert Manta MD5s to a hex string in order
                 * to assure compatibility. */
                var etag = md5ToEtag(info.headers['content-md5']);
                res.header('etag', '"' + etag + '"');
            }

            if (info.headers['durability-level']) {
                var storageClass = durabilityToStorageClass(info.headers['durability-level']);
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

function parseSubdirAndSearchPrefix(bucketPrefix) {
    if (!bucketPrefix || bucketPrefix.length === 0) {
        return {
            subdir: '',
            searchPrefix: ''
        };
    }

    var lastSlashPos = bucketPrefix.lastIndexOf('/');

    if (lastSlashPos === -1) {
        return {
            subdir: '',
            searchPrefix: bucketPrefix
        };
    }

    var hasSearchPrefix = lastSlashPos < bucketPrefix.length - 1;
    var subdir = bucketPrefix.substring(0, lastSlashPos);
    var searchPrefix = hasSearchPrefix ? bucketPrefix.substring(lastSlashPos + 1) : '';

    return {
        subdir: subdir,
        searchPrefix: searchPrefix
    };
}

function buildRelativePathForObject(bucket, parent, name) {
    var bucketPos = parent.indexOf(bucket);
    var relDir = parent.substring(bucketPos + bucket.length + 1);

    return relDir.length > 0 ? relDir + '/' + name : name;
}

function ListObjects(bucket, req, res, next) {
    var client = options.mantaClient;

    mod_assert.string(options.bucketPath, 'options.bucketPath');

    var prefix = req.query.prefix || '';

    req.log.debug("Listing bucket %s/%s", bucket, prefix);

    res.header("Content-Type", "application/xml");

    var xml = mod_xmlbuilder.create({
        ListBucketsResult: {
            '@xmlns': 'http://s3.amazonaws.com/doc/' + options.s3Version + '/',
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
        var xmlText = xml.end({ pretty: options.prettyPrint });
        res.send(xmlText);
        return next();
    }

    var prefixProps = parseSubdirAndSearchPrefix(prefix);
    var hasPrefix = prefixProps.searchPrefix.length > 0;
    var mantaDir = options.bucketPath + '/' + bucket + '/' + prefixProps.subdir;

    var opts = { };

    client.ls(mantaDir, opts, function findAllInBucket(err, list) {
        if (err) {
            if (err.statusCode === 404) {
                res.send(new errors.AllAccessDisabled(err));
            }

            res.send(new errors.InternalError(err));
        }

        list.on('object', function (obj) {
            var relPath = buildRelativePathForObject(bucket, obj.parent, obj.name);

            if (hasPrefix && !mod_lo.startsWith(relPath, prefixProps.searchPrefix)) {
                return;
            }

            var contents = xml.ele('Contents');
            contents.ele('Key', {}, relPath);
            contents.ele('LastModified', {}, obj.mtime);
            contents.ele('ETag');
            contents.ele('Size', {}, obj.size);
            var owner = contents.ele('Owner', {});
            owner.ele('ID', {}, 'idval');
            owner.ele('DisplayName', {}, client.user);

            var storageClass = durabilityToStorageClass(obj.durability);
            owner.ele('StorageClass', {}, storageClass);
        });

        list.on('directory', function(dir) {
            var relPath = buildRelativePathForObject(bucket, dir.parent, dir.name);

            var commonPrefixes = xml.ele('CommonPrefixes');
            commonPrefixes.ele('Prefix', {}, relPath + '/');
        });

        list.once('error', function (err) {
            // TODO: Select error types and emit REST codes
            res.send(new errors.InternalError(err));
        });

        list.once('end', function () {
            var xmlText = xml.end({ pretty: options.prettyPrint });

            res.send(xmlText);
        });
    });

    return next();
}

function GetAcl(bucket, req, res, next) {
    req.log.debug("Getting object ACL %s/%s", bucket, req.path());

    var client = options.mantaClient;

    var owner = {
        ID: 'idval',
        DisplayName: client.user
    };

    var xml = mod_xmlbuilder.create({
        AccessControlPolicy: {
            '@xmlns': 'http://s3.amazonaws.com/doc/' + options.s3Version + '/',
            Owner: owner,
            AccessControlList: {
                Grant: {
                    Grantee: {
                        '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        '@xsi:type': 'CanonicalUser',
                        ID: 'idval',
                        DisplayName: client.user
                    },
                    Permission: 'FULL_CONTROL'
                }
            }
        }
    }, { version: '1.0', encoding: 'UTF-8'});

    var xmlText = xml.end({ pretty: options.prettyPrint });

    res.header("Content-Type", "application/xml");
    res.send(xmlText);

    return next();
}

function PutAcl(bucket, req, res, next) {
    req.log.debug("Putting object ACL (NOOP) %s/%s", bucket, req.path());

    res.send(200);
    return next();
}

function CopyObject(bucket, req, res, next) {
    var source = utils.sanitizeS3Filepath(req.headers['x-amz-copy-source'],
        options.maxFilenameLength);

    mod_assert.string(req.params[0], 'path is not present');

    var objPath = mod_lo.trimStart(req.params[0], '/');
    var mantaPath = options.bucketPath + '/' + bucket + '/' + objPath;
    var mantaDir = mod_path.dirname(mantaPath);

    req.log.debug("Copying object from %s to %s/%s",
        source, bucket, req.path());

    var client = options.mantaClient;

    var fullSource = options.bucketPath + source;

    client.info(fullSource, function linkedObjectInfo(err, info) {
        if (err) {
            // TODO: Figure out what s3 does in this case and emulate it
            res.send(404);
        } else {
            client.info(mantaDir, function headLnDir(headErr) {
                if (headErr) {
                    client.mkdirp(mantaDir, function mkLnObjDir(mkdirErr) {
                        if (mkdirErr) {
                            return next(errors.InternalError(mkdirErr));
                        }
                    });
                }

                var etag = md5ToEtag(info.headers['content-md5']);
                var lastModified = new Date(info.headers['last-modified']).toISOString();

                client.ln(fullSource, mantaPath, function objectLinked(lnErr) {
                    if (lnErr) {
                        return next(errors.InternalError(lnErr));
                    }

                    var xml = mod_xmlbuilder.create({
                        CopyObjectResult: {
                            '@xmlns': 'http://s3.amazonaws.com/doc/' + options.s3Version + '/'
                        }
                    });

                    xml.ele('LastModified', lastModified).up()
                        .ele('ETag').raw('&quot;' + etag + '&quot;').up()
                        .end();

                    var xmlText = xml.end({pretty: options.prettyPrint});

                    res.header("Content-Type", "application/xml");
                    res.send(xmlText);
                });
            });
        }

        return next();
    });
}

module.exports = function (_options) {
    options = _options;

    return {
        addObject: AddObject,
        copyObject: CopyObject,
        deleteObject: DeleteObject,
        getAcl: GetAcl,
        getObject: GetObject,
        listObjects: ListObjects,
        putAcl: PutAcl
    };
};
