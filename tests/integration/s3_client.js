"use strict";

var assert = require('assert-plus');
var AWS = require('aws-sdk');
var proxy = require('proxy-agent');
var bunyan = require('bunyan');

var config;

var log = bunyan.createLogger({
    level: (process.env.LOG_LEVEL || 'debug'),
    name: 's3-client',
    stream: process.stdout
});

function client() {
    var httpOptions = {};

    if (process.env.http_proxy) {
        log.debug('Using proxy with S3 client: %s', process.env.http_proxy);
        httpOptions.agent = proxy(process.env.http_proxy);
    } else if (process.env.https_proxy) {
        log.debug('Using proxy with S3 client: %s', process.env.https_proxy);
        httpOptions.agent = proxy(process.env.https_proxy);
    }

    var client = new AWS.S3({
        apiVersion: '2006-03-01',
        params: {},
        httpOptions: httpOptions,
        endpoint: 'http://localhost:8080',
        sslEnabled: false,
        logger: process.stderr,
        signatureVersion: 'v2',
        credentials: new AWS.Credentials(config.accessKey, config.secretKey)
    });

    assert.ok(client);
    return client;
}

module.exports = function (_config) {
    config = _config;
    
    return {
        client: client
    };
};
