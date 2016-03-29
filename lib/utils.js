"use strict";

var mod_assert = require('assert-plus');

function parseHostname(hostWithPort) {
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

function parseSubdomain(hostname) {
    mod_assert.string(hostname);

    if (hostname.length < 1) {
        return null;
    }

    var firstDotPos = hostname.indexOf('.');

    if (firstDotPos < 0) {
        return null;
    }

    var secondDotPos = hostname.indexOf('.', firstDotPos);

    if (secondDotPos < 0 && hostname.substring(firstDotPos + 1) !== 'localhost') {
        return null;
    }

    return hostname.substring(0, firstDotPos);
}

module.exports = {
    parseHostname: function (hostWithPort) {
        return parseHostname(hostWithPort);
    }
};
