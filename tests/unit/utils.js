"use strict";

var utils = require('../../lib/utils');
var test = require('tape');

test('can parse a hostname without a port', function (t) {
    var hostname = 'subdomain.domain.tld';
    var result = utils.parseHostname(hostname);
    t.equal(result, hostname, 'the hostname without a port should be the same');
    t.end();
});

test('can parse a hostname with a port', function (t) {
    var hostname = 'subdomain.domain.tld:9977';
    var result = utils.parseHostname(hostname);
    t.equal(result, 'subdomain.domain.tld', 'the hostname with a port should be just the domain');
    t.end();
});

test('can deal with only a colon', function (t) {
    var hostname = ':';
    var result = utils.parseHostname(hostname);
    t.equal(result, '', 'if the input is so bad that we only have a colon, return an empty string');
    t.end();
});