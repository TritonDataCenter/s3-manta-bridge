"use strict";

var mod_fs = require('fs');
var mod_lo = require('lodash');
var mod_assert = require('assert-plus');
var mod_request = require('sync-request');
var mod_util = require('util');
var mod_vasync = require('vasync');
var mod_stream = require('stream');

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

    t.equal(res.statusCode, 405, "Expecting server to be reachable at " + host);
    t.end();
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
    var filepath = '../../data/' + object;

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

test('can get an object', function(t) {
    var bucket = 'predictable-bucket-name';
    var object = 'sample.txt';
    var filepath = '../../data/' + object;
    var mantaDir = helper.config.bucketPath + '/' + bucket;
    var mantaPath = mantaDir + '/' + object;

    var fileStream = mod_fs.createReadStream(filepath, { autoClose: true });
    var contents = mod_fs.readFileSync(filepath, "utf8");

    t.plan(4);

    manta.put(mantaPath, fileStream, { mkdirs: true }, function putTestObj(err) {
        t.ifError(err, 'Added ' + mantaPath + ' without problems');

        var params = {
            Bucket: bucket,
            Key: object
        };

        s3.getObject(params, function getObj(err, data) {
            t.ifError(err, 'Got object ' + mantaPath + ' via the S3 API with errors');

            t.ok(data, 'S3 response present');
            var actualContents = data.Body.toString();
            t.equal(actualContents, contents, 'File contents are as expected');

            t.end();
        });
    });
});

test('can add and get an object with metadata', function(t) {
    var bucket = 'predictable-bucket-name';
    var object = 'sample.txt';
    var filepath = '../../data/' + object;

    mod_fs.readFile(filepath, function (err, data) {
        t.ifError(err, filepath + ' read without problems');
        s3.createBucket({ Bucket: bucket}, function(err) {
            t.ifError(err, 'No error when creating [' + bucket + '] bucket');

            var params = {
                Bucket: bucket,
                Key: object,
                Body: data,
                Metadata: {
                    foo: 'bar',
                    animal: 'cat'
                }
            };

            s3.putObject(params, function(err) {
                if (err) {
                    t.fail(err.message);
                }

                s3.getObject({ Bucket: bucket, Key: object }, function getObj(err, data) {
                    t.ifError(err, 'Got object ' + object + ' via the S3 API with errors');

                    t.ok(data, 'S3 response present');
                    var actualMetadata = data.Metadata;
                    t.deepEqual(actualMetadata, params.Metadata, 'Metadata is as expected');

                    t.end();
                });
            });
        });
    });
});

test('can add and get an object with reduced redundancy', function(t) {
    var bucket = 'predictable-bucket-name';
    var object = 'sample.txt';
    var filepath = '../../data/' + object;

    mod_fs.readFile(filepath, function (err, data) {
        t.ifError(err, filepath + ' read without problems');
        s3.createBucket({ Bucket: bucket}, function(err) {
            t.ifError(err, 'No error when creating [' + bucket + '] bucket');

            var params = {
                Bucket: bucket,
                Key: object,
                Body: data,
                StorageClass: 'REDUCED_REDUNDANCY'
            };

            s3.putObject(params, function(err) {
                if (err) {
                    t.fail(err.message);
                }

                s3.getObject({ Bucket: bucket, Key: object }, function getObj(err, data) {
                    t.ifError(err, 'Got object ' + object + ' via the S3 API with errors');

                    t.ok(data, 'S3 response present');
                    var actual = data.StorageClass;
                    t.deepEqual(actual, params.StorageClass, 'Storage class is as expected');

                    t.end();
                });
            });
        });
    });
});

test('cannot get a directory as an object', function(t) {
    var bucket = 'predictable-bucket-name';
    var object = 'test-directory';
    var mantaPath = helper.config.bucketPath + '/' + bucket + '/' + object;

    manta.mkdirp(mantaPath, function(err) {
        t.ifError(err, mantaPath + ' directory created without a problem');

        var params = {
            Bucket: bucket,
            Key: object
        };

        s3.getObject(params, function getObj(err) {
            t.equal(err.code, 404, 'Expecting 404 from server for directory requested as object');
            t.end();
        });
    });
});

test('can delete a single object', function(t) {
    var bucket = 'predictable-bucket-name';
    var object = 'sample.txt';
    var filepath = '../../data/' + object;
    var mantaDir = helper.config.bucketPath + '/' + bucket;
    var mantaPath = mantaDir + '/' + object;

    var fileStream = mod_fs.createReadStream(filepath, { autoClose: true });

    t.plan(3);

    manta.put(mantaPath, fileStream, { mkdirs: true }, function (err) {
        t.ifError(err, 'Added ' + mantaPath + ' without problems');

        var params = {
            Bucket: bucket,
            Key: object
        };

        s3.deleteObject(params, function (err, data) {
            t.ifError(err, 'Deleted object ' + mantaPath + ' via the S3 API without errors');

            t.ok(data, 'S3 response present');
            t.end();
        });
    });
});

function noOfKeys(array, keyName, key) {
    var totalKeys = 0;

    for (var i = 0; i < array.length; i++) {
        if (array[i][keyName] && array[i][keyName] === key) {
            totalKeys++;
        }
    }

    return totalKeys;
}

test('can list a bucket for objects', function(t) {
    var bucket = 'predictable-bucket-name';
    var testData = 'Hello Manta!';

    var testContents = [
        mod_util.format("%s/%s/dir1", helper.config.bucketPath, bucket),
        mod_util.format("%s/%s/file1", helper.config.bucketPath, bucket),
        mod_util.format("%s/%s/dir1/file2", helper.config.bucketPath, bucket),
        mod_util.format("%s/%s/dir2", helper.config.bucketPath, bucket),
        mod_util.format("%s/%s/dir3", helper.config.bucketPath, bucket),
        mod_util.format("%s/%s/dir3/file3", helper.config.bucketPath, bucket),
        mod_util.format("%s/%s/dir3/file4", helper.config.bucketPath, bucket),
        mod_util.format("%s/%s/dir3/dir4/file5", helper.config.bucketPath, bucket),
        mod_util.format("%s/%s/file6", helper.config.bucketPath, bucket)
    ];

    var addTestData = function addTestData(path, cb) {
        if (path.match(/^.*dir[0-9]+[/]*$/)) {
            manta.mkdirp(path, cb);
        } else {
            var buff = new mod_stream.Readable();
            buff.push(testData);
            buff.push(null);

            manta.put(path, buff, { mkdirs: true }, cb);
        }
    };

    mod_vasync.forEachParallel({
        func: addTestData,
        inputs: testContents
    }, function(err, result) {
        t.ifError(err, 'All files added as expected');
        t.equal(result.ndone, 9, 'There should be nine paths created');

        var params = {
            Bucket: bucket
        };

        s3.listObjects(params, function(err, data) {
            t.ifError(err, 'No errors listing objects in bucket');

            t.equal(data.Delimiter, '/', 'Assume forward slash for delimiter because none specified');
            t.equal(data.Prefix, '', 'Assume empty prefix because none specified');
            t.equal(data.Marker, '', 'Assume empty marker because none specified');
            t.equal(data.MaxKeys, 1000, 'Assume 1000 keys by default');

            var files = data.Contents;
            var dirs = data.CommonPrefixes;

            t.equals(files.length, 2, 'there should be only two files displayed');
            t.equals(noOfKeys(files, 'Key', 'file1'), 1, 'there is only 1 file1');
            t.equals(noOfKeys(files, 'Key', 'file6'), 1, 'there is only 1 file6');

            t.equals(dirs.length, 3, 'there should be only three directories displayed');
            t.equals(noOfKeys(dirs, 'Prefix', 'dir1/'), 1, 'there is only 1 dir1');
            t.equals(noOfKeys(dirs, 'Prefix', 'dir2/'), 1, 'there is only 1 dir2');
            t.equals(noOfKeys(dirs, 'Prefix', 'dir3/'), 1, 'there is only 1 dir3');

            t.end();
        });
    });
});

// test('can list a bucket for objects and filter by a prefix', function(t) {
//     t.skip();
// });
