/**
 * @file File containing {@link SignerV2} class definition.
 */
'use strict';

let mod_util = require('util');
let mod_lo = require('lodash');
let mod_crypto = require('crypto');
let mod_assert = require('assert-plus');

let errors = require('./errors');

const SUBRESOURCES = [
    'acl',
    'location',
    'logging',
    'torrent',
    'uploads'
];

/**
 * Class providing a method to authenticate HTTP requests made using S3
 * v2 authentication.
 * @see {@link http://docs.aws.amazon.com/general/latest/gr/signature-version-2.html | AWS V2 signature documentation}
 */
class SignerV2 {
    /**
     * Creates a new instance that authenticates using the passed credentials
     * via the S3 v2 authentication scheme.
     *
     * @param {object} options configuration options loaded when server is started
     * @param {string} options.accessKey S3 compatible access key used to secure server
     * @param {string} options.secretKey S3 compatible access key used to secure server
     * @param {integer} options.maxAllowedSkewMilliseconds maximum skew allowed when authenticating
     */
    constructor(options) {
        /**
         * S3 compatible access key used to secure server.
         * @private
         * @type {string}
         */
        this._accessKey = options.accessKey;

        /**
         * S3 compatible access key used to secure server.
         * @private
         * @type {string}
         */
        this._secretKey = options.secretKey;

        /**
         * Maximum skew allowed when authenticating.
         * @private
         * @type {integer}
         */
        this._maxAllowedSkewMilliseconds = options.maxAllowedSkewMilliseconds;
    }

    /**
     * Authenticates the passed request.
     *
     * @param {external:Request} req request object
     * @param {external:Response} res response object
     * @param {restifyCallback} next callback
     * @returns {*} results of the passed callback
     */
    authenticate(req, res, next) {
        let headers = req.headers;
        let method = req.method;
        let accessKey = this._accessKey;
        mod_assert.string(accessKey);
        let secretKey = this._secretKey;
        mod_assert.string(secretKey);
        let maxAllowedSkewMs = this._maxAllowedSkewMilliseconds;
        let dateString;
        let date;

        if (headers.date) {
            dateString = headers.date;
        } else if (headers['x-amz-date']) {
            dateString = headers['x-amz-date'];
        } else {
            let accessDeniedErr = new errors.AccessDenied(
                'WS authentication requires a valid Date or x-amz-date header');
            return next(accessDeniedErr);
        }

        date = new Date(Date.parse(dateString));

        let now = new Date();
        let skew = Math.abs(now.getTime() - date.getTime());

        if (skew > maxAllowedSkewMs) {
            let skewErr = new errors.RequestTimeTooSkewed(
                'The difference between the request time and the current time is too large.',
                date,
                now,
                maxAllowedSkewMs
            );

            return next(skewErr);
        }

        let pathAndParams = SignerV2._extractPathAndParams(req);
        let authDetails = SignerV2._buildAuthorization(headers, method, pathAndParams, accessKey, secretKey);

        if (authDetails.authorization !== headers.authorization) {
            /* eslint-disable no-console */
            console.log(`COMPUTED: ${authDetails.authorization}`);
            console.log(`ACTUAL:   ${headers.authorization}`);
            let regex = /(?:\r\n|\r|\n)/g;
            console.log(`SignHeaders: ${authDetails.stringToSign.replace(regex, '\\n')}`);
            /* eslint-enable no-console */

            let signatureProvidedParts = headers.authorization.split(':', 2);
            let signatureProvided = mod_lo.get(signatureProvidedParts, 1, '');

            let authErr = new errors.SignatureDoesNotMatch(
                'The request signature we calculated does not match the signature ' +
                'you provided. Check your key and signing method.',
                accessKey,
                authDetails.stringToSign,
                signatureProvided
            );

            return next(authErr);
        }

        return next();
    }

    ///--- PUBLIC STATIC METHODS

    /**
     * Prefix used in authentication header for S3 v2 style authentication.
     * @return {string} constant string value of 'AWS'
     */
    static signaturePrefix() {
        return 'AWS';
    }

    ///--- PRIVATE STATIC METHODS

    /**
     * Extracts the path to be used for signing the request. The path used for
     * signing may differ in subtle ways from the path sent from the client
     * or the path used to point to the resource. In particular, the path
     * used for signing may contain a subresource.
     *
     * @private
     * @param {external:Request} req request object
     * @returns {string} path to sign
     */
    static _extractPathAndParams(req) {
        if (mod_lo.isEmpty(req.params)) {
            return req.path();
        }

        let paramKeys = Object.keys(req.params);

        let subresourceKey = mod_lo.find(paramKeys, function firstEmpty(key) {
            // Subresources shouldn't have a value and they should be in the
            // list of whitelisted values
            return mod_lo.isEmpty(req.params[key]) && mod_lo.includes(SUBRESOURCES, key);
        });

        if (!mod_lo.isEmpty(subresourceKey)) {
            return `${req.path()}?${subresourceKey}`;
        }

        return req.path();
    }
    
    /**
     * Builds authorization header used for comparing against authorization header sent to the
     * server.
     *
     * @private
     * @param {object} headers HTTP headers sent in request
     * @param {string} method HTTP verb sent in request
     * @param {string} pathAndParams path sent in request
     * @param {string} accessKey S3 compatible access key used to secure server
     * @param {string} secretKey S3 compatible access key used to secure server
     * @returns {{authorization, stringToSign: string}} authorization header and string that was signed
     */
    static _buildAuthorization(headers, method, pathAndParams, accessKey, secretKey) {
        let stringToSign = SignerV2._buildStringToSign(headers, method, pathAndParams);

        let hmac = mod_crypto.createHmac('sha1', secretKey);
        hmac.setEncoding('binary');
        hmac.update(stringToSign, 'utf8');
        let base64 = hmac.digest('base64');

        let authorization = mod_util.format(
            '%s %s:%s',
            SignerV2.signaturePrefix(),
            accessKey,
            base64
        );

        return {
            authorization: authorization,
            stringToSign: stringToSign
        };
    }

    /**
     * Creates the string that is signed in order to create the authorization header based
     * on data from the incoming HTTP request.
     *
     * @private
     * @param {object} headers HTTP headers sent in request
     * @param {string} method HTTP verb sent in request
     * @param {string} pathAndParams path sent in request
     * @returns {string} string that is signed as part of the authorization header
     */
    static _buildStringToSign(headers, method, pathAndParams) {
        let xamzKeys = mod_lo.filter(Object.keys(headers), function amzFilter(key) {
            return mod_lo.startsWith(key, 'x-amz');
        }).sort();

        let stringToSign = '';
        stringToSign += method;
        stringToSign += '\n';
        stringToSign += mod_lo.get(headers, 'content-md5', '');
        stringToSign += '\n';
        stringToSign += mod_lo.get(headers, 'content-type', '');
        stringToSign += '\n';
        stringToSign += mod_lo.get(headers, 'date', '');
        stringToSign += '\n';

        xamzKeys.forEach(function appendXamzHeaders(key) {
            stringToSign += mod_lo.trim(key);
            stringToSign += ':';
            stringToSign += mod_lo.trim(headers[key]);
            stringToSign += '\n';
        });

        stringToSign += pathAndParams;

        return stringToSign;
    }
}

module.exports = SignerV2;
