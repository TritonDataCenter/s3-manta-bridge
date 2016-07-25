'use strict';

let Utils = require('../../lib/utils');
let test = require('tape');

test('parseDomainFromHostWithPort - can parse a hostname without a port', function (t) {
    let hostname = 'subdomain.domain.tld';
    let result = Utils.parseDomainFromHostWithPort(hostname);
    t.equal(result, hostname, 'the hostname without a port should be the same');
    t.end();
});

test('parseDomainFromHostWithPort - can parse a hostname with a port', function (t) {
    let hostname = 'subdomain.domain.tld:9977';
    let result = Utils.parseDomainFromHostWithPort(hostname);
    t.equal(result, 'subdomain.domain.tld',
        'the hostname with a port should be just the domain');
    t.end();
});

test('parseDomainFromHostWithPort - can deal with only a colon', function (t) {
    let hostname = ':';
    let result = Utils.parseDomainFromHostWithPort(hostname);
    t.equal(result, '', 'if the input is so bad that we only have a colon, ' +
        'return an empty string');
    t.end();
});

test('parseSubdomain - can extract subdomain from domain with TLD', function (t) {
    let domain = 'www.joyent.com';
    let expectation = 'www';
    let result = Utils.parseSubdomain(domain);
    t.equal(
        result,
        expectation,
        expectation + ' subdomain should be extracted - actually: ' + result
    );
    t.end();
});

test('parseSubdomain - can extract subdomain from localhost without TLD', function (t) {
    let domain = 'subdomain.localhost';
    let expectation = 'subdomain';
    let result = Utils.parseSubdomain(domain);
    t.equal(
        result,
        expectation,
        expectation + ' subdomain should be extracted - actually: ' + result
    );
    t.end();
});

test('parseSubdomain - will return null when no subdomain and TLD present', function (t) {
    let domain = 'joyent.com';
    let expectation = null;
    let result = Utils.parseSubdomain(domain);
    t.equal(
        result,
        expectation,
        'no subdomain should be extracted for domain: ' + domain
    );
    t.end();
});

test('parseSubdomain - null when no subdomain and no TLD present', function (t) {
    let domain = 'localhost';
    let expectation = null;
    let result = Utils.parseSubdomain(domain);
    t.equal(
        result,
        expectation,
        'no subdomain should be extracted for domain: ' + domain
    );
    t.end();
});

test('parseSubdomain - reject domain beginning with dot', function (t) {
    let domain = '.joyent.com';
    let expectation = null;
    let result = Utils.parseSubdomain(domain);
    t.equal(
        result,
        expectation,
        'no subdomain should be extracted for domain: ' + domain
    );
    t.end();
});

test('splitFirstDirectory - can parse first directory from typical path', function(t) {
    let path = '/root/first/second/file.txt';
    let result = Utils.splitFirstDirectory(path);

    t.equal(result.first, '/root', 'expecting first directory to be extracted');
    t.equal(result.remaining, 'first/second/file.txt',
        'expecting remaining path to be returned');
    t.end();
});

test('splitFirstDirectory - can deal with root path (/)', function(t) {
    let path = '/';
    let result = Utils.splitFirstDirectory(path);

    t.equal(result.first, '/', 'expecting root directory');
    t.equal(result.remaining, '', 'expecting empty string');
    t.end();
});

test('splitFirstDirectory - can with relative paths', function(t) {
    let path = '/dir/path/../file.txt';
    let result = Utils.splitFirstDirectory(path);

    t.equal(result.first, '/dir', 'expecting first directory to be extracted');
    t.equal(result.remaining, 'file.txt',
        'expecting relative remaining path to be resolved');
    t.end();
});

test('sanitizeS3Filepath - a sane path will not be changed', function(t) {
    let path = '/testbucket/test.log';
    let result = Utils.sanitizeS3Filepath(path);

    t.equal(result, path, 'path should not be altered');
    t.end();
});

test('sanitizeS3Filepath - a sane path with subdir will not be changed', function(t) {
    let path = '/testbucket/dir1/test.log';
    let result = Utils.sanitizeS3Filepath(path);

    t.equal(result, path, 'path should not be altered');
    t.end();
});

test('sanitizeS3Filepath - double slashes will be collapsed', function(t) {
    let path = '/testbucket//test.log';
    let expected = '/testbucket/test.log';
    let result = Utils.sanitizeS3Filepath(path);

    t.equal(result, expected, 'path should not have double slashes');
    t.end();
});

test('sanitizeS3Filepath - path must start with slash', function(t) {
    let path = 'testbucket/test.log';
    let expected = '/testbucket/test.log';
    let result = Utils.sanitizeS3Filepath(path);

    t.equals(result, expected, 'all paths are relative to the root');
    t.end();
});

test('sanitizeS3Filepath - relative paths should not exist', function(t) {
    let path = '../testbucket/test.log';
    let expected = '/testbucket/test.log';
    let result = Utils.sanitizeS3Filepath(path);

    t.equals(result, expected, 'relative paths are collapsed');
    t.end();
});

test('sanitizeS3Filepath - relative paths are not in the middle', function(t) {
    let path = '/testbucket/dir/../test.log';
    let expected = '/testbucket/test.log';
    let result = Utils.sanitizeS3Filepath(path);

    t.equals(result, expected, 'relative paths are collapsed');
    t.end();
});

test('sanitizeS3Filepath - there should be no leading or training spaces', function(t) {
    let path = ' /testbucket/test.log ';
    let expected = '/testbucket/test.log';
    let result = Utils.sanitizeS3Filepath(path);

    t.equals(result, expected, 'leading and trailing spaces are removed');
    t.end();
});

test('sanitizeS3Filepath - there should be no tabs or new lines', function(t) {
    let path = '/testbucket/\ttest\n\r.log';
    let expected = '/testbucket/test.log';
    let result = Utils.sanitizeS3Filepath(path);

    t.equals(result, expected, 'leading and trailing spaces are removed');
    t.end();
});

test('sanitizeS3Filepath - there should be no tabs or new lines', function(t) {
    let path = '/testbucket/\ttest\n\r.log';
    let expected = '/testbucket/test.log';
    let result = Utils.sanitizeS3Filepath(path);

    t.equals(result, expected, 'leading and trailing spaces are removed');
    t.end();
});

test('sanitizeS3Filepath - we shouldn\'t strip trailing slashes', function(t) {
    let path = '/testbucket/test/';
    let expected = '/testbucket/test/';
    let result = Utils.sanitizeS3Filepath(path);

    t.equals(result, expected, 'trailing slash is preserved');
    t.end();
});

test('sanitizeS3Filepath - a root path should remain unchanged', function(t) {
    let path = '/';
    let expected = '/';
    let result = Utils.sanitizeS3Filepath(path);

    t.equals(result, expected, 'root path wasn\'t preserved');
    t.end();
});

test('sanitizeS3Filepath - a file name with dots should work', function(t) {
    let path = '/myname/stor/directory/server_4.0.0-dp-macos_x86_64.zip';
    let expected = path;

    let result = Utils.sanitizeS3Filepath(path);
    t.equals(result, expected, 'file path was modified');
    t.end();
});
