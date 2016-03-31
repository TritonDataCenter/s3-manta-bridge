"use strict";

var errors = require('restify-errors');
var VError = require('verror');

errors.makeConstructor(
    'NoSuchBucketError', {
        statusCode: 404,
        restCode: 'NoSuchBucket',
        severity: 'debug'
    }
);

errors.makeConstructor(
    'BucketAlreadyExistsError', {
        statusCode: 409,
        restCode: 'BucketAlreadyExists',
        severity: 'debug'
    }
);

errors.makeConstructor(
    'BucketNotEmptyError', {
        statusCode: 409,
        restCode: 'BucketNotEmpty',
        severity: 'debug'
    }
);

errors.makeConstructor(
    'InvalidBucketNameError', {
        statusCode: 400,
        restCode: 'InvalidBucketName',
        severity: 'debug'
    }
);

function bucketError(msg, bucket, cause, error) {
    return cause ?
        new error(cause, msg, bucket) :
        new error(msg, bucket);
}

function BucketAlreadyExistsError(bucket, cause) {
    var msg = 'The specified bucket already exists: %s';
    return bucketError(msg, bucket, cause, errors.BucketAlreadyExistsError);
}

function BucketNotEmptyError(bucket, cause) {
    var msg = 'The specified bucket is not empty: %s';
    return bucketError(msg, bucket, cause, errors.BucketNotEmptyError);
}

function InvalidBucketNameError(bucket, cause) {
    var msg = 'The specified bucket is not valid: %s';

    return bucketError(msg, bucket, cause, errors.InvalidBucketNameError);
}

function NoSuchBucket(bucket, cause) {
    var msg = 'The specified bucket does not exist: %s';

    return bucketError(msg, bucket, cause, errors.NoSuchBucketError);
}

function InternalError(cause) {
    var verr = new VError(cause, 'An internal error occurred');
    verr.statusCode = 500;
    verr.restCode = 'InternalError';
    verr.severity = 'error';

    return verr;
}

module.exports = {
    BucketAlreadyExistsError: BucketAlreadyExistsError,
    BucketNotEmptyError: BucketNotEmptyError,
    InternalError: InternalError,
    InvalidBucketNameError: InvalidBucketNameError,
    NoSuchBucketError: NoSuchBucket
}
