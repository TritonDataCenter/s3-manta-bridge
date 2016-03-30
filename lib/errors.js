"use strict";

var VError = require('verror');

function bucketError(bucket, cause, msg, statusCode, restCode) {
    var verr = cause ? new VError(cause, msg, bucket) : new VError(msg, bucket);
    verr.statusCode = statusCode;
    verr.restCode = restCode;

    return verr;
}

function BucketAlreadyExistsError(bucket, cause) {
    return bucketError(
        bucket,
        cause,
        'The specified bucket already exists: %s',
        409,
        'BucketAlreadyExists'
    );
}

function BucketNotEmptyError(bucket, cause) {
    return bucketError(
        bucket,
        cause,
        'The specified bucket is not valid: %s',
        409,
        'BucketNotEmpty'
    );
}

function InternalError(cause) {
    var verr = new VError(cause, 'An internal error occurred');
    verr.statusCode = 500;
    verr.restCode = 'InternalError';

    return verr;
}

function InvalidBucketNameError(bucket, cause) {
    return bucketError(
        bucket,
        cause,
        'The specified bucket is not valid: %s',
        400,
        'InvalidBucketName'
    );
}

function MethodNotAllowedError(method) {
    var verr = new VError('[%s] is not allowed', method);
    verr.statusCode = 405;
    verr.restCode = 'MethodNotAllowed';

    return verr;
}

function NoSuchBucketError(bucket, cause) {
    return bucketError(
        bucket,
        cause,
        'The specified bucket does not exist: %s',
        404,
        'NoSuchBucket'
    );
}

module.exports = {
    BucketAlreadyExistsError: BucketAlreadyExistsError,
    BucketNotEmptyError: BucketNotEmptyError,
    InternalError: InternalError,
    InvalidBucketNameError: InvalidBucketNameError,
    MethodNotAllowedError: MethodNotAllowedError,
    NoSuchBucketError: NoSuchBucketError
}
