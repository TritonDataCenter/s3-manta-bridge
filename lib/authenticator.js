'use strict';

let mod_lo = require('lodash');
let errors = require('./errors');

let SignerV2 = require('./signer_v2');
let SignerV4 = require('./signer_v4');

/**
 * Class that provides S3 compatible authentication.
 */
class Authenticator {
    constructor(options) {
        /**
         * Configuration options loaded when server is started.
         * @private
         * @type {Object}
         */
        this._options = options;

        this._signer2 = new SignerV2(options);
        this._signer4 = new SignerV4(options);
    }

    /**
     * Authenticates the passed request by choosing the correct authentication
     * scheme by parsing the request.
     *
     * @param {external:Request} req request object
     * @param {external:Response} res response object
     * @param {restifyCallback} next callback
     * @returns {*} results of the passed callback
     */
    authenticate(req, res, next) {
        if (req.method === 'HEAD' && req.path() === '/') {
            return next();
        }

        if (!req.headers.authorization) {
            let msg = 'Anonymous access is forbidden for this operation';
            return next(new errors.AccessDenied(msg));
        }

        // Match based on authorization header received

        if (mod_lo.startsWith(req.headers.authorization, SignerV4.signaturePrefix())) {
            return this._signer4.authenticate(req, res, next);
        } else if (mod_lo.startsWith(req.headers.authorization, SignerV2.signaturePrefix())) {
            return this._signer2.authenticate(req, res, next);
        }

        // If there were no matching auth schemes, then we error

        let badAuthErr = new errors.InvalidArgument('Unsupported Authorization Type');
        badAuthErr.additional = {
            ArgumentName: 'Authorization',
            ArgumentValue: req.headers.authorization
        };

        return next(badAuthErr);
    }
}

module.exports = Authenticator;