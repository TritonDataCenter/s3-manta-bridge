/**
 * Common utilities that may be reused throughout the application.
 *
 * @module utils
 */

"use strict";

var mod_assert = require('assert-plus');

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

module.exports = {
    parseDomainFromHostWithPort: parseDomainFromHostWithPort,
    parseSubdomain: parseSubdomain
};
