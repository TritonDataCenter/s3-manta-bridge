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

function AddObject(bucket, req, res, next) {
    mod_assert.string(req.params[0], 'path is not present');

    var client = options.mantaClient;

    var objPath = mod_lo.trimStart(req.params[0], '/');
    var mantaPath = options.bucketPath + '/' + bucket + '/' + objPath;
    var mantaDir = mod_path.dirname(mantaPath);

    console.log(mantaDir);

    client.mkdirp(mantaDir, function mkObjDir(err) {
        if (err) {
            return next(errors.InternalError(err));
        }

        var opts = { };

        if (req.headers['content-length']) {
            opts.size = Number(req.headers['content-length']);
        }

        if (req.headers['content-type']) {
            opts.type = req.headers['content-type'];
        }

        var write = client.createWriteStream(mantaPath, opts);
        write.cork();

        write.once('close', function putDone(dataRes) {
            console.log("closed: " + mod_util.inspect(dataRes));
            res.send(200);
            return next();
        });

        req.once('end', function readDone() {
            write.uncork();
            console.log('read finished');
        });

        req.pipe(write, { end: true });
    });
}

module.exports = function (_options) {
    options = _options;

    return {
        addObject: AddObject
    };
};
