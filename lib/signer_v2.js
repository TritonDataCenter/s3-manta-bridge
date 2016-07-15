'use strict';

let mod_util = require('util');
let mod_lo = require('lodash');
let mod_crypto = require('crypto');

let errors = require('./errors');

const SIGNATURE_PREFIX = 'AWS';
let options;

function authenticate(req, res, next) {
    let headers = req.headers;
    let method = req.method;
    let path = req.path();
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

    let authDetails = buildAuthorization(headers, method, path, accessKey, secretKey);

    if (authDetails.authorization !== headers.authorization) {
        /* eslint-disable no-console */
        console.log(`COMPUTED: ${authDetails.authorization}`);
        console.log(`ACTUAL:   ${headers.authorization}`);
        console.log(`SignHeaders: ${authDetails.stringToSign.replace(/(?:\r\n|\r|\n)/g, '\\n')}`);
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

function buildAuthorization(headers, method, path, accessKey, secretKey) {
    let stringToSign = buildStringToSign(headers, method, path);

    let hmac = mod_crypto.createHmac('sha1', secretKey);
    hmac.setEncoding('binary');
    hmac.update(stringToSign, 'utf8');
    let base64 = hmac.digest('base64');

    let authorization = mod_util.format(
        '%s %s:%s',
        SIGNATURE_PREFIX,
        accessKey,
        base64
    );

    return {
        authorization: authorization,
        stringToSign: stringToSign
    };
}

function buildStringToSign(headers, method, path) {
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

    stringToSign += path;

    return stringToSign;
}

module.exports = function (_options) {
    options = _options;

    return {
        authenticate: authenticate
    };
};
