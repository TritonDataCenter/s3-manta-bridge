/**
 * @file File containing {@link Routes} class definition.
 */

'use strict';

let mod_assert = require('assert-plus');
let mod_lo = require('lodash');
let mod_restify_errors = require('restify-errors');

let Buckets = require('./buckets');
let Objects = require('./objects');
let errors = require('./errors');
let Utils = require('./utils');

/**
 * This is a class providing a routing API between S3 API and our internal
 * API used to bridge the constructs between S3 and Manta.
 *
 * Unfortunately, the particular configuration of REST-like endpoints combined
 * with GET/POST parameters and differing logic when in/out subdomains leads
 * to a set of routes that can't be represented using a typical Restify routes
 * definition. This module contains all of the logic for routing requests to
 * their handlers.
 */
class Routes {
    /**
     * Creates a new instance of a API endpoint routing object.
     *
     * @param {object} options configuration options loaded when server is started
     * @param {external:MantaClient} mantaClient reference to Manta client instance
     */
    constructor(options, mantaClient) {
        mod_assert.ok(options, 'options');
        mod_assert.ok(mantaClient, 'mantaClient');

        /**
         * Configuration options loaded when server is started.
         * @private
         * @type {Object}
         */
        this._options = options;

        /**
         * Reference to Buckets class.
         * @private
         * @type {Buckets}
         */
        this._buckets = new Buckets(options, mantaClient);

        /**
         * Reference to Objects class.
         * @private
         * @type {Objects}
         */
        this._objects = new Objects(options, mantaClient);
    }

    ///--- PUBLIC METHODS

    /**
     * Routes a request to the correct HTTP verb handler and sends the response
     * back to the client.
     *
     * @param {external:Request} req request object
     * @param {external:Response} res response object
     * @param {restifyCallback} next callback
     */
    route(req, res, next) {
        let log = req.log;
        let method = req.method;

        log.debug('%s %s [%s]', method, req.path(), req.bucket);

        switch (method) {
            case 'HEAD':
                return this._head(req, res, next);
            case 'GET':
                return this._get(req, res, next);
            case 'PUT':
                return this._put(req, res, next);
            case 'POST':
                return this._post(req, res, next);
            case 'DELETE':
                return this._delete(req, res, next);
            default:
                return next(new mod_restify_errors.MethodNotAllowedError(
                    '[%s] is not allowed', method));
        }
    }

    ///--- PRIVATE METHODS

    /**
     * Emulate HEAD requests against buckets and objects.
     *
     * @private
     * @param {external:Request} req request object
     * @param {external:Response} res response object
     * @param {restifyCallback} next callback
     */
    _head(req, res, next) {
        // If we are at the service base, emulate the s3 behavior to not support HEAD
        if (req.isBaseEndpoint) {
            res.send(405);
            return next();
        }

        if (mod_lo.isEmpty(req.bucket)) {
            return next(new errors.InvalidBucketNameError(req.bucket));
        }
        
        return this._buckets.bucketExists(req, res, next);
    }

    /**
     * Emulate GET requests against buckets and objects.
     *
     * @private
     * @param {external:Request} req request object
     * @param {external:Response} res response object
     * @param {restifyCallback} next callback
     */
    _get(req, res, next) {
        let bucketEmpty = mod_lo.isEmpty(req.bucket);

        /* GET with no bucket specified indicates a list buckets operation. */
        if (bucketEmpty) {
            return this._buckets.listBuckets(req, res, next);
        }
        
        /* Only the root directory has been GET - so we are listing bucket contents. */
        if (req.sanitizedPath === '/') {
            if (mod_lo.has(req.params, 'uploads')) {
                return this._objects.listMultipartUploads(req, res, next);
            } else {
                return this._objects.listObjects(req, res, next);
            }
        }

        // We return all objects with full control ACLs
        if (mod_lo.has(req.params, 'acl')) {
            return this._objects.getAcl(req, res, next);
        }

        // Everything else is getting an object
        return this._objects.getObject(req, res, next);
    }

    /**
     * Emulate PUT requests against buckets and objects.
     *
     * @private
     * @param {external:Request} req request object
     * @param {external:Response} res response object
     * @param {restifyCallback} next callback
     */
    _put(req, res, next) {
        if (mod_lo.isEmpty(req.bucket)) {
            return next(new errors.InvalidBucketNameError(req.bucket));
        }
        
        /* A PUT on the root directory indicates adding a bucket */
        if (req.sanitizedPath === '/') {
            return this._buckets.addBucket(req, res, next);
        }

        // Support adding ACL as a NOOP
        if (mod_lo.has(req.params, 'acl')) {
            return this._objects.putAcl(req, res, next);
        }

        if (mod_lo.endsWith(req.sanitizedPath, '/')) {
            return this._objects.createDirectory(req, res, next);
        }

        if (req.headers['x-amz-metadata-directive'] === 'COPY') {
            return this._objects.copyObject(req, res, next);
        }

        return this._objects.addObject(req, res, next);
    }

    /**
     * Emulate POST requests against buckets and objects.
     *
     * Currently, we don't support multi-part POST requests.
     *
     * @private
     * @param {external:Request} req request object
     * @param {external:Response} res response object
     * @param {restifyCallback} next callback
     */
    _post(req, res, next) {
        if (mod_lo.isEmpty(req.bucket)) {
            return next(new errors.InvalidBucketNameError(req.bucket));
        }
        
        res.send(501);
        return next();
    }

    /**
     * Emulate DELETE requests against buckets and objects.
     *
     * @private
     * @param {external:Request} req request object
     * @param {external:Response} res response object
     * @param {restifyCallback} next callback
     */
    _delete(req, res, next) {
        if (mod_lo.isEmpty(req.bucket)) {
            return next(new errors.InvalidBucketNameError(req.bucket));
        }
        
        /* DELETE on the root path indicates a bucket delete. */
        if (req.sanitizedPath === '/') {
            return this._buckets.removeBucket(req, res, next);
        }

        // Everything else is an object
        return this._objects.deleteObject(req, res, next);
    }
}

/**
 * @type {Routes}
 */
module.exports = Routes;
