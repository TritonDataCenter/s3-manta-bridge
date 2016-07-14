'use strict';

var mod_xmlbuilder = require('xmlbuilder');
var mod_lo = require('lodash');

function buildErrorResponse(err) {
    var result = { Error: {
            Code: err.restCode,
            Message: err.message
        }
    };

    if (err.additional) {
        result = mod_lo.merge({}, result, { Error: err.additional });
    }

    return mod_xmlbuilder
        .create(result, { version: '1.0', encoding: 'UTF-8'})
        .end({ pretty: true });
}

function XmlFormatter(req, res, body, next) {
    if (body instanceof Error) {
        var err = body;
        res.statusCode = err.statusCode || 500;

        if (err.restCode) {
            res.restCode = err.restCode;
        }

        // Match the log level with the error severity if available
        if (err.severity && req.log[err.severity]) {
            req.log[err.severity](err);
        } else {
            req.log.error(err);
        }

        var errBody = buildErrorResponse(err);

        return next(null, errBody);
    }

    if (Buffer.isBuffer(body)) {
        return next(null, body.toString('base64'));
    }

    return next(null, body);
}

module.exports = {
    formatter: XmlFormatter
};
