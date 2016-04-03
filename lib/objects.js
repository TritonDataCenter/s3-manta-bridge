/**
 * S3 Object operations
 *
 * @module objects
 */
"use strict";

var mod_assert = require('assert-plus');
var stream = require('stream');
var mod_util = require('util');
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

module.exports = function (_options) {
    options = _options;

    return {
        addObject: AddObject
    };
};
