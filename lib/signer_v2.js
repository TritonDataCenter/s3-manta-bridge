"use strict";

var mod_util = require('util');
var mod_lo = require('lodash');
var mod_crypto = require('crypto');
var mod_resolve_env = require('resolve-env');

var errors = require('./errors');

var SIGNATURE_PREFIX = 'AWS';
var options;

function authenticate(req, res, next) {
    var headers = req.headers;
    var method = req.method;
    var path = req.path();
    var accessKey = mod_resolve_env(options.accessKey);
    var secretKey = mod_resolve_env(options.secretKey);
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

    var authDetails = buildAuthorization(headers, method, path, accessKey, secretKey);

    if (authDetails.authorization !== headers.authorization) {
        console.log("COMPUTED: " + authDetails.authorization);
        console.log("ACTUAL:   " + headers.authorization);
        console.log("SignHeaders: " + authDetails.stringToSign.replace(/(?:\r\n|\r|\n)/g, '\\n'));

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

function buildAuthorization(headers, method, path, accessKey, secretKey) {
    var stringToSign = buildStringToSign(headers, method, path);

    var hmac = mod_crypto.createHmac('sha1', secretKey);
    hmac.setEncoding('binary');
    hmac.update(stringToSign, 'utf8');
    var base64 = hmac.digest('base64');

    var authorization = mod_util.format(
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
    var xamzKeys = mod_lo.filter(Object.keys(headers), function amzFilter(key) {
        return mod_lo.startsWith(key, "x-amz");
    }).sort();

    var stringToSign = '';
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