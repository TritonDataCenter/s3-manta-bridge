'use strict';

let mod_util = require('util');
let mod_lo = require('lodash');
let mod_crypto = require('crypto');
let errors = require('./errors');

const EMPTY_BODY_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const SIGNATURE_PREFIX = 'AWS4-HMAC-SHA256';
let options;

function authenticate(req, res, next) {
    let headers = req.headers;
    let method = req.method;
    let accessKey = options.accessKey;
    let secretKey = options.secretKey;
    let maxAllowedSkewMs = Number(options.maxAllowedSkewMilliseconds);
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

    let authDetails = buildAuthorization(req, headers, method, path, accessKey, secretKey);

    let normalizedAuth = mod_lo.map(headers.authorization.split(','), function normalizeAuth(val) {
        return mod_lo.trim(val);
    }).join(',');

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

function hashAsHex(contents) {
    let hash = mod_crypto.createHash('sha256');
    hash.update(contents, 'utf8');

    return hash.digest('hex');
}

function buildHashedPayload(req) {
    return req.headers['x-amz-content-sha256'] || EMPTY_BODY_HASH;
}

function buildCanonicalQueryString(queryParams) {
    if (mod_lo.isEmpty(queryParams)) {
        return '';
    }

    let keys = Object.keys(queryParams).sort();

    let canonicalQueryString = '';

    for (let i = 0; i < keys.length; i++) {
        if (i > 0) {
            canonicalQueryString += '&';
        }

        canonicalQueryString += uriEncode(keys[i]);
        canonicalQueryString += '=';
        canonicalQueryString += uriEncode(queryParams[keys[i]]);
    }

    return canonicalQueryString;
}

function uriEncode(urlString) {
    return urlString.replace(/[^a-zA-Z0-9\-_\.~]/g, function encodeChars(c) {
        return encodeURIComponent(c);
    });
}

function buildCanonicalHeaders(req, signedHeaders) {
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

function buildCanonicalRequest(method, path, queryParams, canonicalHeaders, signedHeaders,
                               hashedPayload) {
    let canonicalRequest = '';

    canonicalRequest += method;
    canonicalRequest += '\n';
    canonicalRequest += path;
    canonicalRequest += '\n';
    canonicalRequest += buildCanonicalQueryString(queryParams);
    canonicalRequest += '\n';
    canonicalRequest += canonicalHeaders;
    canonicalRequest += '\n';
    canonicalRequest += mod_lo.join(signedHeaders, ';');
    canonicalRequest += '\n';
    canonicalRequest += hashedPayload;

    return canonicalRequest;
}

function parseAuthorization(authorization) {
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

function buildStringToSign(iso8601Date, canonicalRequestHash, date, region, service) {
    let stringToSign = '';
    stringToSign += SIGNATURE_PREFIX;
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

function sign(secretKey, contents, encoding) {
    let hmac = mod_crypto.createHmac('sha256', secretKey);
    hmac.update(contents, 'utf8');

    if (encoding) {
        return hmac.digest(encoding);
    }

    return hmac.digest();
}

function buildSigningKey(parts, secretKey) {
    let dateKey = sign('AWS4' + secretKey, parts.date);
    let dateRegionKey = sign(dateKey, parts.region);
    let dateRegionServiceKey = sign(dateRegionKey, parts.service);
    return sign(dateRegionServiceKey, 'aws4_request');
}

function buildSignature(signingKey, stringToSign) {
    return sign(signingKey, stringToSign, 'hex');
}

function buildAuthorization(req, headers, method, path, accessKey, secretKey) {
    let parts = parseAuthorization(headers.authorization);
    let hashedPayload = buildHashedPayload(req);
    let canonicalHeaders = buildCanonicalHeaders(req, parts.signedHeaders);
    let canonicalRequest = buildCanonicalRequest(req.method, path,
        req.query, canonicalHeaders, parts.signedHeaders, hashedPayload);
    let canonicalRequestHash = hashAsHex(canonicalRequest);
    let stringToSign = buildStringToSign(req.headers['x-amz-date'],
        canonicalRequestHash, parts.date, parts.region, parts.service);
    let signingKey = buildSigningKey(parts, secretKey);
    let signature = buildSignature(signingKey, stringToSign);

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

module.exports = function (_options) {
    options = _options;

    return {
        authenticate: authenticate,
        buildCanonicalRequest: buildCanonicalRequest,
        buildSigningKey: buildSigningKey,
        buildSignature: buildSignature,
        buildStringToSign: buildStringToSign,
        hashAsHex: hashAsHex
    };
};
