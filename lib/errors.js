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

errors.makeConstructor(
    'AccessDenied', {
        statusCode: 403,
        restCode: 'AccessDenied',
        severity: 'debug'
    }
);

errors.makeConstructor(
    'RequestTimeTooSkewed', {
        statusCode: 403,
        restCode: 'RequestTimeTooSkewed',
        severity: 'debug'
    }
);

errors.makeConstructor(
    'SignatureDoesNotMatch', {
        statusCode: 403,
        restCode: 'SignatureDoesNotMatch',
        severity: 'debug'
    }
);

errors.makeConstructor(
    'InvalidArgument', {
        statusCode: 400,
        restCode: 'InvalidArgument',
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

function RequestTimeTooSkewed(msg, requestTime, serverTime, maxAllowedSkewMs) {
    var err = new errors.RequestTimeTooSkewed(msg);
    err.additional = {
        RequestTime: requestTime.toUTCString(),
        ServerTime: serverTime.toUTCString(),
        MaxAllowedSkewMilliseconds: maxAllowedSkewMs
    };

    return err;
}

function SignatureDoesNotMatch(msg, accessKey, stringToSign, signatureProvided) {
    var err = new errors.SignatureDoesNotMatch(msg);
    err.additional = {
        AWSAccessKeyId: accessKey,
        StringToSign: stringToSign,
        SignatureProvided: signatureProvided,
        StringToSignBytes: hexEncodeWithSpaces(stringToSign)
    };

    return err;
}

function hexEncodeWithSpaces(string){
    var buffer = new Buffer(string, 'utf8');
    var hex = '';

    for (var i = 0; i < buffer.length; i++) {
        if (i > 0) {
            hex += ' ';
        }
        
        var b = buffer[i].toString(16);
        if (b.length === 1) {
            hex += '0';
        }

        hex += b;
    }

    return hex;
}

module.exports = {
    AccessDenied: errors.AccessDenied,
    BucketAlreadyExistsError: BucketAlreadyExistsError,
    BucketNotEmptyError: BucketNotEmptyError,
    InvalidArgument: errors.InvalidArgument,
    InternalError: InternalError,
    InvalidBucketNameError: InvalidBucketNameError,
    NoSuchBucketError: NoSuchBucket,
    RequestTimeTooSkewed: RequestTimeTooSkewed,
    SignatureDoesNotMatch: SignatureDoesNotMatch
};
