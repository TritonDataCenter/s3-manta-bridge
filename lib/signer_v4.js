'use strict';

let mod_util = require('util');
let mod_lo = require('lodash');
let mod_crypto = require('crypto');
let errors = require('./errors');

/**
 * Constant checksum for an empty HTTP body.
 * @type {string}
 * @default
 */
const EMPTY_BODY_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/**
 * Class providing a method to authenticate HTTP requests made using S3
 * v4 authentication.
 * @see {@link http://docs.aws.amazon.com/general/latest/gr/signature-version-4.html | AWS V4 signature documentation}
 */
class SignerV4 {
    /**
     * Creates a new instance that authenticates using the passed credentials
     * via the S3 v4 authentication scheme.
     *
     * @param {object} options configuration options loaded when server is started
     * @param {string} options.accessKey S3 compatible access key used to secure server
     * @param {string} options.secretKey S3 compatible access key used to secure server
     * @param {integer} options.maxAllowedSkewMilliseconds maximum skew allowed when authenticating
     */
    constructor(options) {
        this._options = options;
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
        let accessKey = this._options.accessKey;
        let secretKey = this._options.secretKey;
        let maxAllowedSkewMs = Number(this._options.maxAllowedSkewMilliseconds);
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

        let path = req.path();

        let authDetails = SignerV4._buildAuthorization(req, headers, path, secretKey);

        let normalizedAuth = mod_lo.map(headers.authorization.split(','), mod_lo.trim).join(',');

        if (authDetails.authorization !== normalizedAuth) {
            var lineEscRegEx = /(?:\r\n|\r|\n)/g;

            /* eslint-disable no-console */
            console.log(`COMPUTED: ${authDetails.authorization}`);
            console.log(`ACTUAL:   ${normalizedAuth}`);
            console.log(`StringToSign: ${authDetails.stringToSign
                .replace(lineEscRegEx, '\\n')}`);
            console.log(`CanonicalRequest: ${authDetails.canonicalRequest
                .replace(lineEscRegEx, '\\n')}`);
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
     * Prefix used in authentication header for S3 v4 style authentication.
     * @return {string} constant string value of 'AWS4-HMAC-SHA256'
     */
    static signaturePrefix() {
        return 'AWS4-HMAC-SHA256';
    }

    ///--- PRIVATE STATIC METHODS

    /**
     * Creates a SHA256 hash of the provided data and represents it
     * as a hex string.
     *
     * @private
     * @param {string} contents data to create a sha256 hash o
     * @returns {string} hash as a hex string
     */
    static _hashAsHex(contents) {
        let hash = mod_crypto.createHash('sha256');
        hash.update(contents, 'utf8');

        return hash.digest('hex');
    }

    /**
     * Finds the correct hash value for the HTTP request body based on
     * the passed HTTP headers. If there is no body, then the default
     * empty body hash value is returned.
     *
     * @private
     * @param {external:Request} req request object
     * @returns {string} SHA256 encoded as hex string of HTTP body
     */
    static _buildHashedPayload(req) {
        return req.headers['x-amz-content-sha256'] || EMPTY_BODY_HASH;
    }

    /**
     * Builds the {@link http://docs.aws.amazon.com/general/latest/gr/sigv4-create-canonical-request.html|
     * canonical query request} based on the passed query parameters.
     *
     * @private
     * @param {object.<string, string>} queryParams associative array of query keys and values
     * @returns {string} string of concatenated params (e.g. key1=val2&key2=val2...)
     */
    static _buildCanonicalQueryString(queryParams) {
        if (mod_lo.isEmpty(queryParams)) {
            return '';
        }

        let keys = Object.keys(queryParams).sort();

        let canonicalQueryString = '';

        for (let i = 0; i < keys.length; i++) {
            if (i > 0) {
                canonicalQueryString += '&';
            }

            canonicalQueryString += SignerV4._uriEncode(keys[i]);
            canonicalQueryString += '=';
            canonicalQueryString += SignerV4._uriEncode(queryParams[keys[i]]);
        }

        return canonicalQueryString;
    }

    /**
     * URI encodes a given string.
     *
     * @private
     * @param urlString input string to URI encode
     * @returns {string} string with encoded URI entities
     */
    static _uriEncode(urlString) {
        return urlString.replace(/[^a-zA-Z0-9\-_\.~]/g, function encodeChars(c) {
            return encodeURIComponent(c);
        });
    }

    /**
     * Builds the {@link http://docs.aws.amazon.com/general/latest/gr/sigv4-create-canonical-request.html|
     * canonical headers} for the signed headers array passed.
     *
     * @private
     * @param {external:Request} req request object
     * @param {array.string} signedHeaders name of headers to sign
     * @returns {string} concatenated header name/value string
     */
    static _buildCanonicalHeaders(req, signedHeaders) {
        let canonicalHeaders = mod_lo.filter(Object.keys(req.headers), function onlyCanonical(key) {
            return mod_lo.indexOf(signedHeaders, key) >= 0;
        }).sort();

        let headers = '';

        for (let i = 0; i < canonicalHeaders.length; i++) {
            let key = canonicalHeaders[i];
            let cleanKey = mod_lo.replace(mod_lo.trim(key), '  ', ' ');
            let val = req.headers[key];
            let cleanVal = mod_lo.replace(mod_lo.trim(val), '  ', ' ');
            headers += cleanKey + ':' + cleanVal + '\n';
        }

        return headers;
    }

    /**
     * Builds the full {@link http://docs.aws.amazon.com/general/latest/gr/sigv4-create-canonical-request.html|
      * canonical request} based on parameters from the incoming HTTP request.
     *
     * @private
     * @param {string} method HTTP verb sent in request
     * @param {string} path path sent in request
     * @param {object.<string,string>} queryParams associative array of query keys and values
     * @param {string} canonicalHeaders concatenated header name/value string
     * @param {array.string} signedHeaders name of headers to sign
     * @param {string} hashedPayload SHA256 hash as hex string of HTTP body content
     * @returns {string} new line delimited set of properties describing the request
     */
    static _buildCanonicalRequest(method, path, queryParams, canonicalHeaders, signedHeaders,
                                  hashedPayload) {
        let canonicalRequest = '';

        canonicalRequest += method;
        canonicalRequest += '\n';
        canonicalRequest += path;
        canonicalRequest += '\n';
        canonicalRequest += this._buildCanonicalQueryString(queryParams);
        canonicalRequest += '\n';
        canonicalRequest += canonicalHeaders;
        canonicalRequest += '\n';
        canonicalRequest += mod_lo.join(signedHeaders, ';');
        canonicalRequest += '\n';
        canonicalRequest += hashedPayload;

        return canonicalRequest;
    }

    /**
     * Parses the authorization header sent to the server.
     * 
     * @private
     * @param {string} authorization contents of the authorization header
     * @returns {object.<string, string>} associative array of authorization keys and values
     */
    static _parseAuthorization(authorization) {
        let signerStart = 0;
        let signerEnd = authorization.indexOf(' ');

        let credStart = authorization.indexOf('Credential=') + 11;
        let credEnd = authorization.indexOf('/', credStart + 1);

        let dateStart = credEnd + 1;
        let dateEnd = authorization.indexOf('/', dateStart);

        let regionStart = dateEnd + 1;
        let regionEnd = authorization.indexOf('/', regionStart);

        let serviceStart = regionEnd + 1;
        let serviceEnd = authorization.indexOf('/aws4_request');

        let signedHeadersStart = authorization.indexOf('SignedHeaders=') + 14;
        let signedHeadersEnd = authorization.indexOf(',', signedHeadersStart + 1);

        let signedHeadersText = authorization.substring(signedHeadersStart, signedHeadersEnd);
        let signedHeaders = signedHeadersText.split(';');

        let signatureStart = authorization.indexOf('Signature=');
        let signature = authorization.substring(signatureStart, signatureStart + 64);

        return {
            signer: authorization.substring(signerStart, signerEnd),
            credential: authorization.substring(credStart, credEnd),
            credentialBlock: authorization.substring(credStart, serviceEnd),
            date: authorization.substring(dateStart, dateEnd),
            region: authorization.substring(regionStart, regionEnd),
            service: authorization.substring(serviceStart, serviceEnd),
            signedHeaders: signedHeaders,
            signature: signature
        };
    }

    /**
     * Concatenates all of the properties needed to create the string that is
     * signed in order to construct an authorization header.
     *
     * @private
     * @param {string} iso8601Date date string truncated to seconds
     * @param {string} canonicalRequestHash SHA256 hash of canonical request
     * @param {string} date YYYMMDD date string
     * @param {string} region region value for AWS compatibility (eg US)
     * @param {string} service service name for AWS compatibility (eg s3)
     * @returns {string} contents that are signed to create authorization header
     */
    static _buildStringToSign(iso8601Date, canonicalRequestHash, date, region, service) {
        let stringToSign = '';
        stringToSign += SignerV4.signaturePrefix();
        stringToSign += '\n';
        stringToSign += iso8601Date;
        stringToSign += '\n';
        stringToSign += date + '/';
        stringToSign += region + '/';
        stringToSign += service + '/aws4_request';
        stringToSign += '\n';
        stringToSign += canonicalRequestHash;

        return stringToSign;
    }

    /**
     *  Creates a cryptographic hash (SHA256) of the supplied content
     *  using the supplied secret key.
     *
     * @private
     * @param {string} secretKey secret key to use for signing
     * @param {string} contents data to be signed
     * @param {string} [encoding] optional encoding (default: utf8)
     * @returns {Buffer} SHA256 hash of content as binary buffer
     */
    static _sign(secretKey, contents, encoding) {
        let hmac = mod_crypto.createHmac('sha256', secretKey);
        hmac.update(contents, 'utf8');

        if (encoding) {
            return hmac.digest(encoding);
        }

        return hmac.digest();
    }

    /**
     * Generates the signing key used to sign the string to sign in order
     * to generate the authorization header.
     *
     * @private
     * @param {object.<string, string>} parts associative array of values used to create secret key
     * @param {string} secretKey S3 secret key
     * @returns {Buffer} a buffer used as the signing key
     */
    static _buildSigningKey(parts, secretKey) {
        let dateKey = SignerV4._sign('AWS4' + secretKey, parts.date);
        let dateRegionKey = SignerV4._sign(dateKey, parts.region);
        let dateRegionServiceKey = SignerV4._sign(dateRegionKey, parts.service);
        return SignerV4._sign(dateRegionServiceKey, 'aws4_request');
    }

    /**
     * Signs the string to sign with the generated signing key.
     *
     * @private
     * @param {Buffer} signingKey buffer used as the key to sign the string to sign
     * @param {string} stringToSign string to be signed
     * @returns {Buffer} SHA256 signed buffer
     */
    static _buildSignature(signingKey, stringToSign) {
        return SignerV4._sign(signingKey, stringToSign, 'hex');
    }

    /**
     * Builds authorization header used for comparing against authorization header sent to the
     * server.
     *
     * @private
     * @param {external:Request} req request object
     * @param {object.<string, string>} headers associative array of HTTP headers
     * @param {string} path path sent in request
     * @param {string} secretKey S3 secret key
     * @returns {object.<string, string>}
     */
    static _buildAuthorization(req, headers, path, secretKey) {
        let parts = SignerV4._parseAuthorization(headers.authorization);
        let hashedPayload = SignerV4._buildHashedPayload(req);
        let canonicalHeaders = SignerV4._buildCanonicalHeaders(req, parts.signedHeaders);
        let canonicalRequest = SignerV4._buildCanonicalRequest(req.method, path,
            req.query, canonicalHeaders, parts.signedHeaders, hashedPayload);
        let canonicalRequestHash = SignerV4._hashAsHex(canonicalRequest);
        let stringToSign = SignerV4._buildStringToSign(req.headers['x-amz-date'],
            canonicalRequestHash, parts.date, parts.region, parts.service);
        let signingKey = SignerV4._buildSigningKey(parts, secretKey);
        let signature = SignerV4._buildSignature(signingKey, stringToSign);

        let authorization = mod_util.format(
            '%s Credential=%s/aws4_request,SignedHeaders=%s,Signature=%s',
            'AWS4-HMAC-SHA256',
            parts.credentialBlock,
            mod_lo.join(parts.signedHeaders, ';'),
            signature
        );

        return {
            authorization: authorization,
            canonicalRequest: canonicalRequest,
            stringToSign: stringToSign
        };
    }
}

module.exports = SignerV4;