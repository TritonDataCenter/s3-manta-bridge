#!/usr/bin/env node

const path = require('path');
const child_process = require('child_process');
const fs = require('fs');

const mod_glob = require('glob');
const mod_vasync = require('vasync');
const mod_lo = require('lodash');

process.env['AWS_ACCESS_KEY_ID'] = 'INTEGRATIONTESTINGKEY';
process.env['AWS_SECRET_ACCESS_KEY'] = 'neverforgettowritetestsforyourcodeorelse0';
process.env['S3_BRIDGE_HOST'] = 'localhost';

const CWD = path.resolve(`${__dirname}/../../`);

const out = fs.openSync('./out.log', 'a');

global.serverProcess = child_process.fork('app', {
    cwd: CWD,
    env: process.env,
    silent: false,
    detached: true,
    stdio: 'ignore'
});

function cleanUp(cb) {
    if (global.serverProcess) {
        console.log('Shutting down server');
        global.serverProcess.kill();
    }
}

process.on('exit', cleanUp);
process.on('SIGTERM', cleanUp);
process.on('SIGINT', cleanUp);
process.on('SIGUSR2', cleanUp);

var jsPattern = `${CWD}/test/integration/nodejs/*.test.js`;

// Runs JS integration tests
mod_glob(jsPattern, function (err, files) {
    for (var i = 0; i < files.length; i++) {
        try {
            require(path.resolve(CWD, files[i]));
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    }
});

// var batsPattern = `${CWD}/test/integration/s3cmd/*.test.bats`;
//
// mod_glob(batsPattern, function (err, files) {
//     for (var i = 0; i < files.length; i++) {
//         try {
//             var exec = `${CWD}/node_modules/.bin/bats ${files[i]}`;
//
//             var batsProcess = child_process.execSync(
//                 exec,
//                 {
//                     cwd: CWD,
//                     shell: '/bin/sh',
//                     env: process.env,
//                     silent: false
//                 }
//             );
//         } catch (err) {
//             console.error(err);
//             process.exit(1);
//         }
//     }
// });
