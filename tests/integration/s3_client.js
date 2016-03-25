"use strict";

var assert = require('assert-plus');
var AWS = require('aws-sdk');
var proxy = require('proxy-agent');

function client() {
    var httpOptions = {}

    if (process.env.http_proxy) {
        httpOptions.agent = proxy(process.env.http_proxy);
    } else if (process.env.https_proxy) {
        httpOptions.agent = proxy(process.env.https_proxy);
    }

    AWS.config.update({
        httpOptions: httpOptions,
        sslEnabled: false,
        credentials: new AWS.Credentials('', '', null)
    });

    var client = new AWS.S3();
    assert.ok(client);
    return client;
}

module.exports = {
    client: client
};
