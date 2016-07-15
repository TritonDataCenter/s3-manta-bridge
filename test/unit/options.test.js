'use strict';

let Options = require('../../lib/options');
let test = require('tape');
let config = require('../../etc/config.json');

test('can import config options from required json file', function (t) {
    let instance = new Options(config);
    t.end();
});
