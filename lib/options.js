'use strict';

let mod_lo = require('lodash');
let mod_resolve_env = require('resolve-env');
let mod_clone = require('clone');

let utils = require('./utils');

class Options {
    constructor(config) {
        this.authEnabled = Options.loadOption(config, 'authEnabled', true, 'boolean');
        this.baseHostname = Options.loadOption(config, 'baseHostname');
        this.serverPort = Options.loadOption(config, 'serverPort', 8080, 'integer');
        this.prettyPrint = Options.loadOption(config, 'prettyPrint', false, 'boolean');
        this.bucketPath = Options.loadOption(config, 'bucketPath', '~~/stor/s3_buckets');
        this.baseSubdomain = Options.loadOption(config, 'baseSubdomain', 's3');
        this.maxRequestBodySize = Options.loadOption(config, 'maxRequestBodySize', 1073741824, 'integer');
        this.s3Version = Options.loadOption(config, 's3Version', '2006-03-01');
        this.accessKey = Options.loadOption(config, 'accessKey');
        this.accessKey = Options.loadOption(config, 'secretKey');
        this.maxAllowedSkewMilliseconds = Options.loadOption(config, 'maxAllowedSkewMilliseconds', 900000, 'integer');
        this.defaultDurability = Options.loadOption(config, 'defaultDurability', 2, 'integer');
        this.maxFilenameLength = Options.loadOption(config, 'maxFilenameLength', 1024, 'integer');
        this.storageClassMappingToDurability = Options.loadOption(config, 'storageClassMappingToDurability',
            {
                "STANDARD": 2,
                "STANDARD_IA": 2,
                "REDUCED_REDUNDANCY": 1,
                "GLACIER": 1
            });
        this.durabilityMappingToStorageClass = Options.loadOption(config, 'durabilityMappingToStorageClass',
            {
                "2": "STANDARD",
                "1": "REDUCED_REDUNDANCY"
            });
        this.manta = Options.loadOption(config, 'manta',
            {
                "user": "$MANTA_USER",
                "subuser": "$MANTA_SUBUSER",
                "role": "$MANTA_ROLE",
                "insecure": "$MANTA_TLS_INSECURE",
                "keyId": "$MANTA_KEY_ID",
                "url": "$MANTA_URL",
                "privateKeyPath": "$MANTA_KEY_PATH",
                "connectTimeout": 4000
            });
    }

    ///--- PRIVATE METHODS

    /**
     * Processes option by choosing default if key is missing, interpolating
     * environment variables and normalizing strings.
     *
     * @private
     * @param {object} config configuration hash to look for key
     * @param {string} key string to query configuration has for
     * @param {*} [defaultValue] default value to return if key isn't present
     * @param {string} [coerceType] type to cast value to (integer or boolean) - if empty string is assumed
     * @returns {*} value associated with key, if missing defaultValue
     */
    static loadOption(config, key, defaultValue, coerceType) {
        let value;
        let unprocessedValue = mod_lo.hasIn(config, key) ? config[key] : defaultValue;

        if (mod_lo.isString(unprocessedValue)) {
            let unprocessedTrimmed = mod_lo.trim(unprocessedValue);
            let interpolated = mod_resolve_env(unprocessedTrimmed);

            if (coerceType == 'integer') {
                value = mod_lo.toInteger(interpolated);
            } else if (coerceType == 'boolean') {
                value = interpolated === '1' || interpolated === 'true' || interpolated === 't';
            } else {
                value = mod_lo.isEmpty(interpolated) ? defaultValue : interpolated;
            }
        } else if (mod_lo.isObject(unprocessedValue)) {
            value = mod_clone(unprocessedValue);
            utils.interpolateEnvVars(value);
        } else {
            value = unprocessedValue;
        }

        return value;
    }
}

/**
 * @type {Options}
 */
module.exports = Options;
