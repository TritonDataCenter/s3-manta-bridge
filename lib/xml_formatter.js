"use strict";

var mod_xmlbuilder = require('xmlbuilder');

function XmlFormatter(req, res, body, cb ) {
    if (body instanceof Error) {
        res.statusCode = body.statusCode || 500;
        var errorBody = buildErrorResponse(body);
        return cb(null, errorBody);
    }

    if (Buffer.isBuffer(body)) {
        return cb(null, body.toString('base64'));
    }

    return cb(null, body);
}

function buildErrorResponse(err) {
    var result = { Error: {
            Code: err.restCode,
            Message: err.message
        }
    };

    return mod_xmlbuilder
        .create(result, { version: '1.0', encoding: 'UTF-8'})
        .end({ pretty: true });
}

module.exports = {
    formatter: XmlFormatter
};
