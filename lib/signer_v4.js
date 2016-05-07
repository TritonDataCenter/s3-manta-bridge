"use strict";

var mod_util = require('util');
var mod_lo = require('lodash');
var mod_crypto = require('crypto');

var errors = require('./errors');

var SIGNATURE_PREFIX = 'AWS4-HMAC-SHA256';
var options;

function authenticate(req, res, next) {
    var headers = req.headers;
    var method = req.method;
    var path = req.path();
    var accessKey = options.accessKey;
    var secretKey = options.secretKey;
    var maxAllowedSkewMs = Number(options.maxAllowedSkewMilliseconds);
    var dateString;
    var date;

    if (headers.date) {
        dateString = headers.date;
    } else if (headers['x-amz-date']) {
        dateString = headers['x-amz-date'];
    } else {
        var accessDeniedErr = new errors.AccessDenied('WS authentication requires a valid Date or x-amz-date header');
        return next(accessDeniedErr);
    }

    date = new Date(Date.parse(dateString));

    var now = new Date();
    var skew = Math.abs(now.getTime() - date.getTime());

    if (skew > maxAllowedSkewMs) {
        var skewErr = new errors.RequestTimeTooSkewed(
            'The difference between the request time and the current time is too large.',
            date,
            now,
            maxAllowedSkewMs
        );

        return next(skewErr);
    }

    var authDetails = buildAuthorization(req, headers, method, path, accessKey, secretKey);

    if (authDetails.authorization !== headers.authorization) {
        console.log("COMPUTED: " + authDetails.authorization);
        console.log("ACTUAL:   " + headers.authorization);
        console.log("StringToSign: " + authDetails.stringToSign.replace(/(?:\r\n|\r|\n)/g, '\\n'));
        console.log("CanonicalRequest: " + authDetails.canonicalRequest.replace(/(?:\r\n|\r|\n)/g, '\\n'));

        var signatureProvidedParts = headers.authorization.split(':', 2);
        var signatureProvided = mod_lo.get(signatureProvidedParts, 1, '');

        var authErr = new errors.SignatureDoesNotMatch(
            'The request signature we calculated does not match the signature you provided. Check your key and signing method.',
            accessKey,
            authDetails.stringToSign,
            signatureProvided
        );

        return next(authErr);
    }

    return next();
}

function hashAsHex(contents) {
    var hash = mod_crypto.createHash('sha256');
    hash.update(contents, 'utf8');

    return hash.digest('hex');
}

function buildHashedPayload(req) {
    var body = req.body || '';
    return hashAsHex(body);
}

function s3UriEncode(urlString) {
    return urlString.replace(/[!'()*]/g, function encodeChars(c) {
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    });
}

function buildCanonicalHeaders(req) {
    var canonicalHeaders = mod_lo.filter(Object.keys(req.headers), function onlyCanonical(key) {
        return mod_lo.startsWith(key, 'x-amz') ||
            key === 'content-type' ||
            key === 'host';
    }).sort();

    var headers = '';

    for (var i = 0; i < canonicalHeaders.length; i++) {
        var key = canonicalHeaders[i];
        headers += mod_lo.trim(key) + ':' + req.headers[key] + '\n';
    }

    return headers;
}

function buildCanonicalRequest(method, path, query, canonicalHeaders, signedHeaders,
                               hashedPayload) {
    var canonicalRequest = '';

    canonicalRequest += method;
    canonicalRequest += '\n';
    canonicalRequest += path;
    canonicalRequest += '\n';
    canonicalRequest += query ? s3UriEncode(query) : '';
    canonicalRequest += '\n';
    canonicalRequest += canonicalHeaders;
    canonicalRequest += '\n';
    canonicalRequest += mod_lo.join(signedHeaders, ';');
    canonicalRequest += '\n';
    canonicalRequest += hashedPayload;

    return canonicalRequest;
}

function parseAuthorization(authorization) {
    var signerStart = 0;
    var signerEnd = authorization.indexOf(' ');

    var credStart = authorization.indexOf('Credential=') + 11;
    var credEnd = authorization.indexOf('/', credStart + 1);

    var dateStart = credEnd + 1;
    var dateEnd = authorization.indexOf('/', dateStart);

    var regionStart = dateEnd + 1;
    var regionEnd = authorization.indexOf('/', regionStart);

    var serviceStart = regionEnd + 1;
    var serviceEnd = authorization.indexOf('/aws4_request');

    var signedHeadersStart = authorization.indexOf('SignedHeaders=') + 14;
    var signedHeadersEnd = authorization.indexOf(',', signedHeadersStart + 1);

    var signedHeadersText = authorization.substring(signedHeadersStart, signedHeadersEnd);
    var signedHeaders = signedHeadersText.split(';');

    var signatureStart = authorization.indexOf('Signature=');
    var signature = authorization.substring(signatureStart, signatureStart + 64);

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
    var stringToSign = '';
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
    var hmac = mod_crypto.createHmac('sha256', secretKey);
    hmac.update(contents, 'utf8');

    if (encoding) {
        return hmac.digest(encoding);
    }

    return hmac.digest();
}

function buildSigningKey(parts, secretKey) {
    var dateKey = sign('AWS4' + secretKey, parts.date);
    var dateRegionKey = sign(dateKey, parts.region);
    var dateRegionServiceKey = sign(dateRegionKey, parts.service);
    return sign(dateRegionServiceKey, 'aws4_request');
}

function buildSignature(signingKey, stringToSign) {
    return sign(signingKey, stringToSign, 'hex');
}

function buildAuthorization(req, headers, method, path, accessKey, secretKey) {
    var parts = parseAuthorization(headers.authorization);
    var hashedPayload = buildHashedPayload(req);
    var canonicalHeaders = buildCanonicalHeaders(req);
    var canonicalRequest = buildCanonicalRequest(req.method, req.path(),
        req.query(), canonicalHeaders, parts.signedHeaders, hashedPayload);
    var canonicalRequestHash = hashAsHex(canonicalRequest);
    var stringToSign = buildStringToSign(req.headers['x-amz-date'],
        canonicalRequestHash, parts.date, parts.region, parts.service);
    var signingKey = buildSigningKey(parts, secretKey);
    var signature = buildSignature(signingKey, stringToSign);

    var authorization = mod_util.format(
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
