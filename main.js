"use strict";

var assert = require('assert-plus');
var bunyan = require('bunyan');
var clone = require('clone');

var app = require('./lib');

///--- Globals

var DEFAULTS = {
    file: process.cwd() + '/etc/config.json',
    port: 80
};

var NAME = 's3-manta-bridge';

var LOG = bunyan.createLogger({
    name: NAME,
    level: (process.env.LOG_LEVEL || 'info'),
    stream: process.stdout
});

function run(options) {
    assert.object(options);

    var opts = clone(options);
    opts.log = LOG;
    opts.name = NAME;

    var server = app.createServer(opts);
    server.listen(options.serverPort, function () {
        opts.log.info('%s listening at %s', server.name, server.url);
    });
}

///--- Mainline

(function main() {
    var config = require(DEFAULTS.file);

    LOG.debug({
        config: config
    }, 'main: options and config parsed');

    run(config);
})();