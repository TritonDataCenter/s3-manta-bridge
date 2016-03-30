/**
 * Common utilities that may be reused throughout the application.
 *
 * @module utils
 */

"use strict";

var mod_assert = require('assert-plus');
var mod_path = require('path');

/**
 * Parses out the domain name from a hostname that includes a port.
 * @param hostWithPort host in the form of 'myhost.com:9999'
 * @returns {string} full domain name
 */
function parseDomainFromHostWithPort(hostWithPort) {
    mod_assert.string(hostWithPort);

    if (hostWithPort.length < 1) {
        return hostWithPort;
    }

    var colonPos = hostWithPort.indexOf(':');

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
function parseSubdomain(domain) {
    mod_assert.string(domain);

    if (domain.length < 1 || domain.substring(0, 1) === '.') {
        return null;
    }

    var firstDotPos = domain.indexOf('.');

    if (firstDotPos < 0) {
        return null;
    }

    var secondDotPos = domain.indexOf('.', firstDotPos + 1);
    var onlyOneDot = firstDotPos >= 0 && secondDotPos < 0;

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
function splitFirstDirectory(path) {
    mod_assert.string(path, 'path should be string');
    var normalized = mod_path.normalize(path);

    if (normalized === '/') {
        return {
            first: '/',
            remaining: ''
        };
    }

    var slashPos = normalized.indexOf('/', 1);

    return {
        first: normalized.substring(0, slashPos),
        remaining: normalized.substring(slashPos + 1)
    };
}

module.exports = {
    parseDomainFromHostWithPort: parseDomainFromHostWithPort,
    parseSubdomain: parseSubdomain,
    splitFirstDirectory: splitFirstDirectory
};
