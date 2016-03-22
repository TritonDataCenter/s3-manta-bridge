"use strict";

var helper = require('./helper');
var tape = require('tape');
var vasync = require('vasync');

///--- Globals

function test(name, testRun) {
    helper.createServer(function() {
        vasync.pipeline({
            funcs: [
                function run(_, cb) {
                    tape.test(name, testRun);
                    cb();
                },
                function cleanup(_, cb) {
                    helper.cleanupServer(function() {});
                    cb();
                }
            ],
            arg: null
        }, function (err) {
            if (err) {
                throw err;
            }
        });
    });
}

/////--- Tests

test('test-test', function(t) {
    var log = helper.createLogger(t.name);

    log.info("hello");
    t.end();
});
