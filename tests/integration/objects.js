"use strict";

var mod_fs = require('fs');
var mod_lo = require('lodash/util');
var mod_assert = require('assert-plus');
var mod_request = require('sync-request');
var mod_vasync = require('vasync');
var mod_uuid = require('node-uuid');

///--- Globals
var helper = require('./helper');

/** @type {MantaClient} */
var manta = helper.mantaClient;
var s3 = helper.s3Client;
var test = helper.test;

/////--- Tests

test('server is alive', function (t) {
    t.plan(1);
    var port = helper.config.serverPort;
    var host = 'http://localhost:' + port;
    var res = mod_request('HEAD', host);

    t.equal(res.statusCode, 200, "Expecting server to be reachable at " + host);
});

test('test bucket subdomain is active', function(t) {
    var bucket = 'predictable-bucket-name';

    var port = helper.config.serverPort;
    var host = 'http://' + bucket + '.localhost:' + port;
    var res = mod_request('HEAD', host);

    /* A 404 means that we connected and it is the right status code
     * because there is no bucket at that location currently. */
    t.equal(res.statusCode, 404, "Expecting server to be reachable at " + host);
    t.end();
});

test('can add an object', function(t) {
    var bucket = 'predictable-bucket-name';
    var object = 'sample.txt';
    var filepath = '../data/' + object;

    mod_fs.readFile(filepath, function (err, data) {
        t.ifError(err, filepath + ' read without problems');
        s3.createBucket({ Bucket: bucket}, function(err) {
            t.ifError(err, 'No error when creating [' + bucket + '] bucket');

            var params = {
                Bucket: bucket,
                Key: object,
                Body: data
            };

            s3.putObject(params, function(err, data) {
                if (err) {
                    t.fail(err.message);
                }
                t.end();
            });
        });
    });
});