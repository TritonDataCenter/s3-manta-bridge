'use strict';

let mod_lo = require('lodash');
let errors = require('./errors');

let signer2;
let signer4;
let options;

const V2_SIGNATURE_PREFIX = 'AWS ';
const V4_SIGNATURE_PREFIX = 'AWS4-HMAC-SHA256 ';

function authenticate(req, res, next) {
    if (req.method === 'HEAD' && req.path() === '/') {
        return next();
    }

    if (!req.headers.authorization) {
        return next(new errors.AccessDenied('Anonymous access is forbidden for this operation'));
    }

    // Match based on authorization header received

    if (mod_lo.startsWith(req.headers.authorization, V2_SIGNATURE_PREFIX)) {
        return signer2.authenticate(req, res, next);
    } else if (mod_lo.startsWith(req.headers.authorization, V4_SIGNATURE_PREFIX)) {
        return signer4.authenticate(req, res, next);
    }

    // If there were no matching auth schemes, then we error

    let badAuthErr = new errors.InvalidArgument('Unsupported Authorization Type');
    badAuthErr.additional = {
        ArgumentName: 'Authorization',
        ArgumentValue: req.headers.authorization
    };

    return next(badAuthErr);
}

module.exports = function (_options) {
    options = _options;
    signer2 = require('./signer_v2')(options);
    signer4 = require('./signer_v4')(options);

    return {
        authenticate: authenticate
    };
};
