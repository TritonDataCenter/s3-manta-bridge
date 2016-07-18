/**
 * @file File containing {@link Utils} class definition.
 */

'use strict';

let mod_lo = require('lodash');
let mod_assert = require('assert-plus');
let mod_path = require('path');
let mod_resolve_env = require('resolve-env');


/**
 * Class containing static methods used as common utility functions.
 */
class Utils {
    /**
     * Parses out the domain name from a hostname that includes a port.
     * @param hostWithPort host in the form of 'myhost.com:9999'
     * @returns {string} full domain name
     */
    static parseDomainFromHostWithPort(hostWithPort) {
        mod_assert.string(hostWithPort);

        if (hostWithPort.length < 1) {
            return hostWithPort;
        }

        let colonPos = hostWithPort.indexOf(':');

        if (colonPos < 0) {
            return hostWithPort;
        }

        return hostWithPort.substring(0, colonPos);
    }

    /**
     * Parses out the subdomain from the specified domain. Domain must have a TLD
     * or be localhost.
     * @param domain valid domain name
     * @returns {string|null} null if no subdomain, otherwise subdomain name.
     */
    static parseSubdomain(domain) {
        mod_assert.string(domain);

        if (domain.length < 1 || domain.substring(0, 1) === '.') {
            return null;
        }

        let firstDotPos = domain.indexOf('.');

        if (firstDotPos < 0) {
            return null;
        }

        let secondDotPos = domain.indexOf('.', firstDotPos + 1);
        let onlyOneDot = firstDotPos >= 0 && secondDotPos < 0;

        if (onlyOneDot && domain.substring(firstDotPos + 1) !== 'localhost') {
            return null;
        }

        return domain.substring(0, firstDotPos);
    }

    /**
     * Parses a path for its first directory and splits out the remaining path.
     * @param path a valid path using the / separator
     * @returns {Object} with parameters "first" and "remaining"
     */
    static splitFirstDirectory(path) {
        mod_assert.string(path, 'path should be string');
        let normalized = mod_path.normalize(path);

        if (normalized === '/') {
            return {
                first: '/',
                remaining: ''
            };
        }

        let slashPos = normalized.indexOf('/', 1);

        return {
            first: normalized.substring(0, slashPos),
            remaining: normalized.substring(slashPos + 1)
        };
    }

    /**
     * Finds the bucket name for a given request by either parsing the subdomain or the prepended
     * path (in the case of a subdomainless query).
     * @param {string} path HTTP query path
     * @param {string} hostname FQDN of host that received request
     * @param {string} baseSubdomain subdomain used when a bucket isn't specified
     * @returns {string} S3 bucket name
     */
    static findBucketName(path, hostname, baseSubdomain) {
        let bucket;
        let host = Utils.parseDomainFromHostWithPort(hostname);

        // typically a bucket is identified by the subdomain
        let subdomain = Utils.parseSubdomain(host);

        /* It is possible to use a S3 bucket outside of a subdomain. For example,
         * s3cmd supports adding buckets directly to the base subdomain. Thus, we
         * detect if the subdomain is valid and if it isn't, we fall back to
         * behavior that depends on the value of the first parsed parameter from
         * the routes. */
        let subdomainIsBucket =
            subdomain !== null &&
            subdomain.length > 1 &&
            subdomain !== baseSubdomain;

        if (!subdomainIsBucket) {
            if (mod_lo.isEmpty(path)) {
                bucket = null;
            } else {
                let firstDir = Utils.splitFirstDirectory(path).first;
                // Strip slashes because a bucket will never have slashes
                bucket = mod_lo.trim(firstDir, '/');
            }
        } else {
            bucket = subdomain;
        }

        return bucket;
    }

    /**
     * Parses S3 path, normalizes and removes any dodgy characters - like
     * relative paths that may cause security issues when emulating the
     * S3 API using the Manta path structure.
     *
     * @param {string} path S3 file path
     * @param {integer} maxLength maximum length for file path
     * @returns {string} path with offending characters removed
     */
    static sanitizeS3Filepath(path, maxLength) {
        let maxLen = maxLength || 1024;
        if (path.length > maxLen) {
            throw new Error('File path is larger than the maximum length of ' + maxLen);
        }

        let trimmed = mod_lo.trim(path);
        let normalized = mod_path.normalize(trimmed);
        let resolved = mod_path.resolve('/', normalized);

        let dodgyCharsRemoved = resolved
        // Replace control characters
        /* eslint-disable no-control-regex */
            .replace(/[\x00-\x1f\x80-\x9f]/g, '');
        /* eslint-enable no-control-regex */

        if (!mod_path.isAbsolute(dodgyCharsRemoved)) {
            throw new Error('Path must be absolute. Actual path: ' + dodgyCharsRemoved);
        }

        return dodgyCharsRemoved;
    }

    /**
     * Interpolates all $XXXX values of the object to their matching environment variables.
     * Beware this function mutates the passed object.
     * @param object target object to inject environment variables in to
     */
    static interpolateEnvVars(object) {
        mod_lo.forOwn(object, function interpolateEnv(v, k) {
            if (mod_lo.isString(v)) {
                object[k] = mod_lo.trim(mod_resolve_env(v));
            }

            // TODO: Make me a proper recursive function
            if (mod_lo.isObject(v)) {
                mod_lo.forOwn(v, function interpolateSubObjEnv(subV, subK) {
                    if (mod_lo.isString(subV)) {
                        v[subK] = mod_lo.trim(mod_resolve_env(subV));
                    }
                });
            }
        });
    }
}

module.exports = Utils;