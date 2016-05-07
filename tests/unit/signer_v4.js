"use strict";

var signer4 = require('../../lib/signer_v4')({});
var test = require('tape');

test('canBuildCanonicalRequestV4', function (t) {
    var expected = 'GET\n' +
        '/\n' +
        'Action=ListUsers&Version=2010-05-08\n' +
        'content-type:application/x-www-form-urlencoded; charset=utf-8\n' +
        'host:iam.amazonaws.com\n' +
        'x-amz-date:20150830T123600Z\n\n' +
        'content-type;host;x-amz-date\n' +
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    var canonicalHeaders = 'content-type:application/x-www-form-urlencoded; charset=utf-8\n' +
        'host:iam.amazonaws.com\n' +
        'x-amz-date:20150830T123600Z\n';

    var actual = signer4.buildCanonicalRequest(
        'GET',
        '/',
        'Action=ListUsers&Version=2010-05-08',
        canonicalHeaders,
        [ 'content-type', 'host', 'x-amz-date' ],
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );

    t.equal(actual, expected, 'Canonical request build as expected');

    t.end();
});

test('canHashCanonicalRequestV4', function(t) {
    var canonicalRequest = 'GET\n' +
        '/\n' +
        'Action=ListUsers&Version=2010-05-08\n' +
        'content-type:application/x-www-form-urlencoded; charset=utf-8\n' +
        'host:iam.amazonaws.com\n' +
        'x-amz-date:20150830T123600Z\n\n' +
        'content-type;host;x-amz-date\n' +
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    var expected = 'f536975d06c0309214f805bb90ccff089219ecd68b2577efef23edd43b7e1a59';
    var actual = signer4.hashAsHex(canonicalRequest);

    t.equal(actual, expected, 'Canonical request hashed as expected');

    t.end();
});

test('canBuildStringToSignV4', function (t) {
    var expected = 'AWS4-HMAC-SHA256\n' +
        '20150830T123600Z\n' +
        '20150830/us-east-1/iam/aws4_request\n' +
        'f536975d06c0309214f805bb90ccff089219ecd68b2577efef23edd43b7e1a59';

    var actual = signer4.buildStringToSign(
        '20150830T123600Z',
        'f536975d06c0309214f805bb90ccff089219ecd68b2577efef23edd43b7e1a59',
        '20150830',
        'us-east-1',
        'iam');

    t.equal(actual, expected, 'String to sign was constructed as expected');

    t.end();
});

test('canBuildSigningKeyV4', function (t) {
    var secretKey = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY';

    var parts = {
        date: '20150830',
        region: 'us-east-1',
        service: 'iam'
    };

    var expected = new Buffer([ 196, 175, 177, 204, 87, 113, 216, 113, 118, 58,
        57, 62, 68, 183, 3, 87, 27, 85, 204, 40, 66, 77, 26, 94, 134, 218, 110,
        211, 193, 84, 164, 185 ]);

    var actual = signer4.buildSigningKey(parts, secretKey);

    t.equal(
        actual.toString('hex'),
        expected.toString('hex'),
        'Signing key is created as expected'
    );

    t.end();
});

test('canBuildSignatureV4', function (t) {
    var signingKey = new Buffer([ 196, 175, 177, 204, 87, 113, 216, 113, 118, 58,
        57, 62, 68, 183, 3, 87, 27, 85, 204, 40, 66, 77, 26, 94, 134, 218, 110,
        211, 193, 84, 164, 185 ]);

    var stringToSign = 'AWS4-HMAC-SHA256\n' +
        '20150830T123600Z\n' +
        '20150830/us-east-1/iam/aws4_request\n' +
        'f536975d06c0309214f805bb90ccff089219ecd68b2577efef23edd43b7e1a59';

    var expected = '5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7';

    var actual = signer4.buildSignature(signingKey, stringToSign);

    t.equal(actual, expected, 'Signature was generated correctly');

    t.end();
});
