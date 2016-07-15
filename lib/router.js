/**
 * Endpoint routing module.
 *
 * Unfortunately, the particular configuration of REST-like endpoints combined
 * with GET/POST parameters and differing logic when in/out subdomains leads
 * to a set of routes that can't be represented using a typical Restify routes
 * definition. This module contains all of the logic for routing requests to
 * their handlers.
 *
 * @module router
 */

'use strict';

let mod_assert = require('assert-plus');
let mod_lo = require('lodash');
let mod_restify_errors = require('restify-errors');

let Buckets = require('./buckets');
let Objects = require('./objects');
let errors = require('./errors');
let utils = require('./utils');

module.exports = class Route {
    constructor(options, mantaClient) {
        mod_assert.ok(options, 'options');
        mod_assert.ok(mantaClient, 'mantaClient');

        this._options = options;
        this._buckets = new Buckets(options, mantaClient);
        this._objects = new Objects(options, mantaClient);
    }

    head(isBaseEndpoint, bucket, req, res, next) {
        // If we are at the service base, emulate the s3 behavior to not support HEAD
        if (isBaseEndpoint) {
            res.send(405);
            return next();
        }

        if (bucket === null) {
            return next(new errors.InvalidBucketNameError(bucket));
        }
        return this._buckets.bucketExists(bucket, req, res, next);
    }

    get(isBaseEndpoint, bucket, req, res, next) {
        let bucketEmpty = bucket === null || bucket === '';

        if (isBaseEndpoint && bucketEmpty) {
            return this._buckets.listBuckets(req, res, next);
        }

        if (bucket === null) {
            return next(new errors.InvalidBucketNameError(bucket));
        }

        let paths = utils.splitFirstDirectory(req.path());

        /* We aren't on a subdomain and only a single directory has been GET,
         * so we are listing bucket contents. */
        if (isBaseEndpoint && paths.remaining.length < 1) {
            return this._objects.listObjects(bucket, req, res, next);
        }

        /* We aren't on a subdomain and there is more being GET than a single
         * directory, so we are getting an object. */
        if (isBaseEndpoint) {
            // We return all objects with full control ACLs
            if (mod_lo.has(req.params, 'acl')) {
                return this._objects.getAcl(bucket, req, res, next);
            }

            req.params = [paths.remaining];
            return this._objects.getObject(bucket, req, res, next);
        }

        /* We are on a subdomain and only the root directory has been GET,
         * so we are listing bucket contents. */
        if (isBaseEndpoint || (paths.first === '/' && paths.remaining.length < 1)) {
            return this._objects.listObjects(bucket, req, res, next);
        }

        // We return all objects with full control ACLs
        if (mod_lo.has(req.params, 'acl')) {
            return this._objects.getAcl(bucket, req, res, next);
        }

        // Everything else is getting an object
        req.params = [req.path()];

        return this._objects.getObject(bucket, req, res, next);
    }

    put(isBaseEndpoint, bucket, req, res, next) {
        if (bucket === null) {
            return next(new errors.InvalidBucketNameError(bucket));
        }

        let paths = utils.splitFirstDirectory(req.path());

        /* We aren't on a subdomain and only a single directory has been PUT,
         * so we are adding a bucket. */
        if (isBaseEndpoint && paths.remaining.length < 1) {
            return this._buckets.addBucket(bucket, req, res, next);
        }

        /* We aren't on a subdomain and there is more being PUT than a single
         * directory, so we are adding an object. */
        if (isBaseEndpoint) {
            // Support adding ACL as a NOOP
            if (mod_lo.has(req.params, 'acl')) {
                return this._objects.putAcl(bucket, req, res, next);
            }

            req.params = [paths.remaining];

            if (req.headers['x-amz-metadata-directive'] === 'COPY') {
                return this._objects.copyObject(bucket, req, res, next);
            }

            return this._objects.addObject(bucket, req, res, next);
        }

        /* We are on a subdomain and only the root directory has been PUT,
         * so we are adding a bucket. */
        if (isBaseEndpoint || (paths.first === '/' && paths.remaining.length < 1)) {
            return this._buckets.addBucket(bucket, req, res, next);
        }

        // Support adding ACL as a NOOP
        if (mod_lo.has(req.params, 'acl')) {
            return this._objects.putAcl(bucket, req, res, next);
        }

        // Everything else is an object
        req.params = [req.path()];

        if (req.headers['x-amz-metadata-directive'] === 'COPY') {
            return this._objects.copyObject(bucket, req, res, next);
        }

        return this._objects.addObject(bucket, req, res, next);
    }

    post(isBaseEndpoint, bucket, req, res, next) {
        res.send(501);
        return next();
    }

    del(isBaseEndpoint, bucket, req, res, next) {
        if (bucket === null) {
            return next(new errors.InvalidBucketNameError());
        }

        let paths = utils.splitFirstDirectory(req.path());

        if (isBaseEndpoint && paths.remaining.length < 1) {
            return this._buckets.removeBucket(bucket, req, res, next);
        }

        if (isBaseEndpoint) {
            req.params = [paths.remaining];
            return this._objects.deleteObject(bucket, req, res, next);
        }

        /* We are on a subdomain and only the root directory has been DELETE,
         * so we are removing a bucket. */
        if (isBaseEndpoint || (paths.first === '/' && paths.remaining.length < 1)) {
            return this._buckets.removeBucket(bucket, req, res, next);
        }

        // Everything else is an object
        req.params = [req.path()];
        return this._objects.deleteObject(bucket, req, res, next);
    }

    route(req, res, next) {
        let log = req.log;
        let method = req.method;
        let host = utils.parseDomainFromHostWithPort(req.headers.host);

        // typically a bucket is identified by the subdomain
        let subdomain = utils.parseSubdomain(host);
        let bucket = utils.findBucketName(req, this._options);

        let isBaseEndpoint = subdomain === null || subdomain === this._options.baseSubdomain;

        log.debug('%s %s [%s]', method, req.path(), bucket);

        switch (method) {
            case 'HEAD':
                return this.head(isBaseEndpoint, bucket, req, res, next);
            case 'GET':
                return this.get(isBaseEndpoint, bucket, req, res, next);
            case 'PUT':
                return this.put(isBaseEndpoint, bucket, req, res, next);
            case 'POST':
                return this.post(isBaseEndpoint, bucket, req, res, next);
            case 'DELETE':
                return this.del(isBaseEndpoint, bucket, req, res, next);
            default:
                return next(new mod_restify_errors.MethodNotAllowedError(
                    '[%s] is not allowed', method));
        }
    }
};
