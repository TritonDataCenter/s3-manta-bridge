/**
 * @file File containing {@link Options} class definition.
 */
'use strict';

let mod_lo = require('lodash');
let mod_resolve_env = require('resolve-env');
let mod_clone = require('clone');

let utils = require('./utils');

/**
 * Class providing a well-defined API for accessing the configuration options needed
 * to run the application.
 */
class Options {
    /**
     * Creates a new instance and populates the instance with the parsed values from the
     * supplied object as an associative array.
     * 
     * @param {object} config configuration options loaded when server is started
     * @param {boolean} config.authEnabled when true authentication is enabled
     * @param {string} config.baseHostname root hostname that is subdomains prefix
     * @param {integer} config.serverPort port to listen on for connections
     * @param {boolean} config.prettyPrint enable pretty printing of output
     * @param {string} config.bucketPath path to the Manta directory containing buckets
     * @param {string} config.baseSubdomain default subdomain to use for general requests
     * @param {integer} config.maxRequestBodySize maximum number of bytes to support in a single HTTP request
     * @param {string} config.s3Version S3 API version to report to client
     * @param {string} config.accessKey S3 compatible access key used to secure server
     * @param {string} config.secretKey S3 compatible access key used to secure server
     * @param {integer} config.maxAllowedSkewMilliseconds maximum skew allowed when authenticating
     * @param {integer} config.defaultDurability default number of copies to make of new objects
     * @param {integer} config.maxFilenameLength maximum length of full file path
     * @param {object} config.storageClassMappingToDurability mapping of S3 storage classes to durability levels
     * @param {object} config.durabilityMappingToStorageClass mapping of durability levels to S3 storage classes
     * @param {object} config.manta Manta client connection parameters
     */
    constructor(config) {
        /**
         * When true authentication is enabled.
         * @type {boolean}
         * @default true
         */
        this.authEnabled = Options.loadOption(config, 'authEnabled', true, 'boolean');

        /**
         * Root hostname that is subdomains prefix.
         * @type {string}
         */
        this.baseHostname = Options.loadOption(config, 'baseHostname');

        /**
         * Port to listen on for connections.
         * @type {integer}
         * @default 8080
         */
        this.serverPort = Options.loadOption(config, 'serverPort', 8080, 'integer');

        /**
         * Enable pretty printing of output.
         * @type {boolean}
         * @default false
         */
        this.prettyPrint = Options.loadOption(config, 'prettyPrint', false, 'boolean');
        
        /**
         * Path to the Manta directory containing buckets.
         * @type {string}
         * @default ~~/stor/s3_buckets
         */
        this.bucketPath = Options.loadOption(config, 'bucketPath', '~~/stor/s3_buckets');

        /**
         * Default subdomain to use for general requests.
         * @type {string}
         * @default s3
         */
        this.baseSubdomain = Options.loadOption(config, 'baseSubdomain', 's3');

        /**
         * Maximum number of bytes to support in a single HTTP request.
         * @type {integer}
         * @default 1073741824
         */
        this.maxRequestBodySize = Options.loadOption(config, 'maxRequestBodySize', 1073741824, 'integer');

        /**
         * S3 API version to report to client.
         * @type {string}
         * @default 2006-03-01
         */
        this.s3Version = Options.loadOption(config, 's3Version', '2006-03-01');

        /**
         * S3 compatible access key used to secure server.
         * @type {string}
         */
        this.accessKey = Options.loadOption(config, 'accessKey');

        /**
         * S3 compatible access key used to secure server.
         * @type {string}
         */
        this.accessKey = Options.loadOption(config, 'secretKey');

        /**
         * Maximum skew allowed when authenticating.
         * @type {integer}
         * @default 900000
         */
        this.maxAllowedSkewMilliseconds = Options.loadOption(config, 'maxAllowedSkewMilliseconds', 900000, 'integer');

        /**
         * Default number of copies to make of new objects.
         * @type {integer}
         * @default 2
         */
        this.defaultDurability = Options.loadOption(config, 'defaultDurability', 2, 'integer');

        /**
         * Maximum length of full file path.
         * @type {integer}
         * @default 1024
         */
        this.maxFilenameLength = Options.loadOption(config, 'maxFilenameLength', 1024, 'integer');

        /**
         * Mapping of S3 storage classes to durability levels.
         * @type {object}
         */
        this.storageClassMappingToDurability = Options.loadOption(config, 
            'storageClassMappingToDurability',
            {
                'STANDARD': 2,
                'STANDARD_IA': 2,
                'REDUCED_REDUNDANCY': 1,
                'GLACIER': 1
            });

        /**
         * Mapping of durability levels to S3 storage classes.
         * @type {object}
         */
        this.durabilityMappingToStorageClass = Options.loadOption(config, 'durabilityMappingToStorageClass',
            {
                '2': 'STANDARD',
                '1': 'REDUCED_REDUNDANCY'
            });

        /**
         * Manta client connection parameters.
         * @type {object}
         */
        this.manta = Options.loadOption(config, 'manta',
            {
                'user': '$MANTA_USER',
                'subuser': '$MANTA_SUBUSER',
                'role': '$MANTA_ROLE',
                'insecure': '$MANTA_TLS_INSECURE',
                'keyId': '$MANTA_KEY_ID',
                'url': '$MANTA_URL',
                'privateKeyPath': '$MANTA_KEY_PATH',
                'connectTimeout': 4000
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

            if (coerceType === 'integer') {
                value = mod_lo.toInteger(interpolated);
            } else if (coerceType === 'boolean') {
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
