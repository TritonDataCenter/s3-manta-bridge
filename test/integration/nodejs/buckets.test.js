'use strict';

let mod_lo = require('lodash/util');
let mod_assert = require('assert-plus');
let mod_request = require('sync-request');
let mod_vasync = require('vasync');
let mod_uuid = require('node-uuid');

///--- Globals
let helper = require('./helper');

/** @type {MantaClient} */
let manta = helper.mantaClient;
let s3 = helper.s3Client;
let test = helper.test;

/////--- Tests

test('server is alive', function (t) {
    let port = helper.config.serverPort;
    let host = `http://${helper.config.baseHostname}:${port}`;
    let res = mod_request('HEAD', host);

    t.equal(res.statusCode, 405, `Expecting server to be reachable at ${host}`);
    t.end();
});

test('test bucket subdomain is active', function(t) {
    let bucket = 'predictable-bucket-name';

    let port = helper.config.serverPort;
    let host = `http://${bucket}.${helper.config.baseHostname}:${port}`;
    let res = mod_request('HEAD', host);

    /* A 404 means that we connected and it is the right status code
     * because there is no bucket at that location currently. */
    t.equal(res.statusCode, 404, `Expecting server to be reachable at ${host}`);
    t.end();
});

test('can list buckets - no buckets', function (t) {
   s3.listBuckets(function(err, data) {
       t.ifError(err, 'Expecting S3 buckets list call to succeed');

       let buckets = data.Buckets;
       t.equal(buckets.length, 0, 'Expecting no buckets to return');
       t.end();
   });
});

test('can list buckets - one bucket', function (t) {
   let newBucket = 'test-' + mod_uuid.v4();
   let newBucketPath = helper.config.bucketPath + '/' + newBucket;

   mod_vasync.pipeline({
       'funcs': [
           function (_, next) {
               manta.mkdirp(newBucketPath, function (err) {
                   t.ifError(err, 'Expecting mkdirp to succeed for ' + newBucket);
                   next();
               });
           },
           function () {
               s3.listBuckets(function (err, data) {
                   t.ifError(err, 'Expecting S3 buckets list call to succeed');

                   let buckets = data.Buckets;
                   t.equal(buckets.length, 1, 'Only a single bucket expected');
                   t.equal(buckets[0].Name, newBucket, 'Bucket is named: ' + newBucket);
                   t.end();
               });
           }
       ]
   });
});

test('can list buckets - one thousand two hundred buckets', function (t) {
   // This number of buckets forces the Manta client to paginate
   let iterations = 1200;

   let newBucketPrefix = helper.config.bucketPath + '/';

   function mkdir(dir, cb) {
       manta.mkdir(dir, cb);
   }

   mod_vasync.pipeline({
       'funcs': [
           function (_, next) {
               let queue = mod_vasync.queue(mkdir, 20);

               queue.on('end', function() {
                   next();
               });

               let mkdirErrHandle = function (err) {
                   mod_assert.ifError(err);
               };

               let buckets = mod_lo.times(iterations, function() {
                   return newBucketPrefix + 'test-' + mod_uuid.v4();
               });

               queue.push(buckets, mkdirErrHandle);
               queue.close();
           },
           function () {
               s3.listBuckets(function (err, data) {
                   t.ifError(err, 'Expecting S3 buckets list call to succeed');

                   let buckets = data.Buckets;
                   t.equal(buckets.length, iterations, iterations + ' expected');
                   t.end();
               });
           }
       ]
   });
});

test('can add bucket', function(t) {
    let bucket = 'predictable-bucket-name';
    s3.createBucket({ Bucket: bucket}, function(err) {
        t.ifError(err, `No error when creating [${bucket}] bucket`);

        let mantaPath = `${helper.config.bucketPath}/${bucket}`;
        manta.info(mantaPath, function(err) {
            t.ifError(err, `Bucket doesn't exist at Manta path: ${mantaPath}`);
            t.end();
        });
    });
});

test('can\'t add the same bucket twice', function(t) {
    let bucket = 'predictable-bucket-name';
    s3.createBucket({ Bucket: bucket}, function(err) {
        t.ifError(err, `No error when creating [${bucket}] bucket`);

        let mantaPath = `${helper.config.bucketPath}/${bucket}`;

        manta.info(mantaPath, function(err) {
            t.ifError(err, `Bucket exists at Manta path: ${mantaPath}`);

            s3.createBucket({ Bucket: bucket}, function(err) {
                t.ok(err, `Error should be thrown on duplicate bucket. Error: ${err.message}`);
                t.equal(err.code, 'BucketAlreadyExists',
                    `Code should be BucketAlreadyExists. Actually: ${err.code}`);
                t.equal(err.statusCode, 409,
                    `Status code should be 409. Actually: ${err.statusCode}`);
                t.end();
            });
        });
    });
});

test('can delete bucket', function (t) {
    let bucket = 'predictable-bucket-name';

    let mantaPath = helper.config.bucketPath + '/' + bucket;

    manta.mkdirp(mantaPath, function (err) {
        t.ifError(err, 'Expecting mkdirp to succeed for ' + bucket);

        manta.info(mantaPath, function (err) {
            t.ifError(err, 'Expecting bucket to exist');

            s3.deleteBucket({ Bucket: bucket}, function(err) {
                t.ifError(err, 'Expecting delete bucket to succeed for: ' + bucket);
                t.end();
            });
        });
    });
});

test('can\'t delete bucket that doesn\'t exist', function(t) {
    let bucket = 'predictable-bucket-name';

    s3.deleteBucket({ Bucket: bucket}, function(err) {
        t.ok(err, `Expecting delete bucket to fail. Message: ${err.message}`);
        t.equal(err.code, 'NoSuchBucket', `Code should be NoSuchBucket. Actually: ${err.code}`);
        t.equal(err.statusCode, 404, `Status code should be 404. Actually: ${err.statusCode}`);
        t.end();
    });
});

test('can\'t delete bucket that is not empty', function(t) {
    let bucket = 'predictable-bucket-name';

    let mantaPath = `${helper.config.bucketPath}/${bucket}/additional-dir`;

    manta.mkdirp(mantaPath, function (err) {
        t.ifError(err, 'Expecting mkdirp to succeed for ' + bucket);

        s3.deleteBucket({ Bucket: bucket}, function(err) {
            t.ok(err, `Expecting error because bucket is not empty. Message: ${err.message}`);
            t.equal(err.code, 'BucketNotEmpty',
                `Code should be BucketNotEmpty. Actually: ${err.code}`);
            t.equal(err.statusCode, 409,
                `Status code should be 409. Actually: ${err.statusCode}`);
            t.end();
        });
    });
});

test('can HEAD request bucket and find out if it exists', function(t) {
    let bucket = 'predictable-bucket-name';
    let mantaPath = `${helper.config.bucketPath}/${bucket}`;

    manta.mkdirp(mantaPath, function (err) {
        t.ifError(err, `Expecting mkdirp to succeed for ${bucket}`);

        s3.headBucket({ Bucket: bucket}, function(err) {
            t.ifError(err, 'Expecting HEAD request to succeed for: ' + bucket);
            t.end();
        });
    });
});

test('can HEAD request bucket and find out if it doesn\'t exist', function(t) {
    let bucket = 'predictable-bucket-name';

    s3.headBucket({ Bucket: bucket}, function(err) {
        t.ok(err, 'Expecting HEAD request to fail. Message: ' + err.message);
        t.equal(err.code, 'NotFound', 'Code should be NotFound. Actually: ' + err.code);
        t.equal(err.statusCode, 404, 'Status code should be 404. Actually: ' + err.statusCode);
        t.end();
    });
});
