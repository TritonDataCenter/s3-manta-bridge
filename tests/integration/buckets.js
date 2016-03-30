"use strict";

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

//test('can list buckets - no buckets', function (t) {
//   t.plan(2);
//
//   s3.listBuckets(function(err, data) {
//       t.ifError(err, 'Expecting S3 buckets list call to succeed');
//
//       var buckets = data.Buckets;
//       t.equal(buckets.length, 0, 'Expecting no buckets to return');
//   });
//});
//
//test('can list buckets - one bucket', function (t) {
//   var newBucket = 'test-' + mod_uuid.v4();
//   var newBucketPath = helper.config.bucketPath + '/' + newBucket;
//
//   mod_vasync.pipeline({
//       'funcs': [
//           function (_, next) {
//               manta.mkdirp(newBucketPath, function (err) {
//                   t.ifError(err, 'Expecting mkdirp to succeed for ' + newBucket);
//                   next();
//               });
//           },
//           function (_) {
//               s3.listBuckets(function (err, data) {
//                   t.ifError(err, 'Expecting S3 buckets list call to succeed');
//
//                   var buckets = data.Buckets;
//                   t.equal(buckets.length, 1, 'Only a single bucket expected');
//                   t.equal(buckets[0].Name, newBucket, 'Bucket is named: ' + newBucket);
//                   t.end();
//               });
//           }
//       ]
//   });
//});
//
//test('can list buckets - one thousand two hundred buckets', function (t) {
//   // This number of buckets forces the Manta client to paginate
//   var iterations = 1200;
//
//   var newBucketPrefix = helper.config.bucketPath + '/';
//
//   function mkdir(dir, cb) {
//       manta.mkdir(dir, cb);
//   }
//
//   mod_vasync.pipeline({
//       'funcs': [
//           function (_, next) {
//               var queue = mod_vasync.queue(mkdir, 20);
//
//               queue.on('end', function() {
//                   next();
//               });
//
//               var mkdirErrHandle = function (err) {
//                   mod_assert.ifError(err);
//               };
//
//               var buckets = mod_lo.times(iterations, function() {
//                   return newBucketPrefix + 'test-' + mod_uuid.v4();
//               });
//
//               queue.push(buckets, mkdirErrHandle);
//               queue.close();
//           },
//           function () {
//               s3.listBuckets(function (err, data) {
//                   t.ifError(err, 'Expecting S3 buckets list call to succeed');
//
//                   var buckets = data.Buckets;
//                   t.equal(buckets.length, iterations, iterations + ' expected');
//                   t.end();
//               });
//           }
//       ]
//   });
//});
//
//test('can add bucket', function(t) {
//    var bucket = 'predictable-bucket-name';
//    s3.createBucket({ Bucket: bucket}, function(err, data) {
//        t.ifError(err, 'No error when creating [' + bucket + '] bucket');
//
//        var mantaPath = helper.config.bucketPath + '/' + bucket;
//        manta.info(mantaPath, function(err) {
//            t.ifError(err, 'Bucket exists at Manta path: ' + mantaPath);
//            t.end();
//        });
//    });
//});
//
//
//test("can't add the same bucket twice", function(t) {
//    var bucket = 'predictable-bucket-name';
//    s3.createBucket({ Bucket: bucket}, function(err, data) {
//        t.ifError(err, 'No error when creating [' + bucket + '] bucket');
//
//        var mantaPath = helper.config.bucketPath + '/' + bucket;
//        manta.info(mantaPath, function(err) {
//            t.ifError(err, 'Bucket exists at Manta path: ' + mantaPath);
//        });
//
//        s3.createBucket({ Bucket: bucket}, function(err) {
//            t.ok(err, 'Error should be thrown on duplicate bucket. Error: ' + err.message);
//            t.end();
//        });
//    });
//});

test('can delete bucket', function(t) {
    var bucket = 'predictable-bucket-name';

    var mantaPath = helper.config.bucketPath + '/' + bucket;

    manta.mkdirp(mantaPath, function (err) {
        t.ifError(err, 'Expecting mkdirp to succeed for ' + bucket);

        s3.deleteBucket({ Bucket: bucket}, function(err, data) {
            t.ifError(err, 'Expecting delete bucket to succeed for: ' + bucket);
            t.end();
        });
    });
});
