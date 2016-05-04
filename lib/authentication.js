"use strict";

var mod_util = require('util');

var errors = require('./errors');

var SIGNATURE_PREFIX = 'AWS ';
var options;

function authenticate(req, res, next) {
    var headers = req.headers;
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
    var skew = now.getTime() - date.getTime();

    if (skew > maxAllowedSkewMs) {
        var skewErr = new errors.RequestTimeTooSkewed(
            'The difference between the request time and the current time is too large.',
            date,
            now,
            maxAllowedSkewMs
        );

        return next(skewErr);
    }

    var authorization = buildAuthorization(headers, dateString, accessKey, secretKey);

    console.log(authorization);

    next();
}

function buildAuthorization(headers, dateString, accessKey, secretKey) {
    return mod_util.format(
        '%s %s:%s',
        SIGNATURE_PREFIX,
        accessKey,
        buildSignature(headers, dateString, secretKey)
    );
}

function buildSignature(headers, dateString, secretKey) {
    return '';
}

module.exports = function (_options) {
    options = _options;

    return {
        authenticate: authenticate
    };
};