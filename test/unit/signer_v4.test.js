'use strict';

let mod_qs = require('qs');
let SignerV4 = require('../../lib/signer_v4');
let test = require('tape');

let signer4 = new SignerV4({});

test('canBuildCanonicalRequestV4', function (t) {
    let expected = 'GET\n' +
        '/\n' +
        'Action=ListUsers&Version=2010-05-08\n' +
        'content-type:application/x-www-form-urlencoded; charset=utf-8\n' +
        'host:iam.amazonaws.com\n' +
        'x-amz-date:20150830T123600Z\n\n' +
        'content-type;host;x-amz-date\n' +
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    let canonicalHeaders = 'content-type:application/x-www-form-urlencoded; charset=utf-8\n' +
        'host:iam.amazonaws.com\n' +
        'x-amz-date:20150830T123600Z\n';

    let actual = SignerV4.buildCanonicalRequest(
        'GET',
        '/',
        mod_qs.parse('Action=ListUsers&Version=2010-05-08'),
        canonicalHeaders,
        [ 'content-type', 'host', 'x-amz-date' ],
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );

    t.equal(actual, expected, 'Canonical request build as expected');

    t.end();
});

test('canBuildCanonicalRequestWithQueryV4', function (t) {
    let expected = 'GET\n' +
        '/foo/\n' +
        'delimiter=%2F\n' +
        'host:localhost:8080\n' +
        'x-amz-content-sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\n' +
        'x-amz-date:20160510T234533Z\n\n' +
        'host;x-amz-content-sha256;x-amz-date\n' +
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    let canonicalHeaders = 'host:localhost:8080\n' +
        'x-amz-content-sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\n' +
        'x-amz-date:20160510T234533Z\n';

    let actual = SignerV4.buildCanonicalRequest(
        'GET',
        '/foo/',
        mod_qs.parse('delimiter=/'),
        canonicalHeaders,
        [ 'host', 'x-amz-content-sha256', 'x-amz-date' ],
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );

    t.equal(actual, expected, 'Canonical request build as expected');

    t.end();
});

test('canBuildCanonicalRequestWithUnicodeQueryV4', function (t) {
    let expected = 'GET\n' +
        '/foo/\n' +
        'delimiter=%2F&prefix=%E3%81%93%E3%82%8C\n' +
        'host:localhost:8080\n' +
        'x-amz-content-sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\n' +
        'x-amz-date:20160511T002340Z\n\n' +
        'host;x-amz-content-sha256;x-amz-date\n' +
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    let canonicalHeaders = 'host:localhost:8080\n' +
        'x-amz-content-sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\n' +
        'x-amz-date:20160511T002340Z\n';

    let actual = SignerV4.buildCanonicalRequest(
        'GET',
        '/foo/',
        mod_qs.parse('delimiter=/&prefix=これ'),
        canonicalHeaders,
        [ 'host', 'x-amz-content-sha256', 'x-amz-date' ],
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );

    t.equal(actual, expected, 'Canonical request build as expected');

    t.end();
});

test('canHashCanonicalRequestV4', function(t) {
    let canonicalRequest = 'GET\n' +
        '/\n' +
        'Action=ListUsers&Version=2010-05-08\n' +
        'content-type:application/x-www-form-urlencoded; charset=utf-8\n' +
        'host:iam.amazonaws.com\n' +
        'x-amz-date:20150830T123600Z\n\n' +
        'content-type;host;x-amz-date\n' +
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    let expected = 'f536975d06c0309214f805bb90ccff089219ecd68b2577efef23edd43b7e1a59';
    let actual = SignerV4.hashAsHex(canonicalRequest);

    t.equal(actual, expected, 'Canonical request hashed as expected');

    t.end();
});

test('canBuildStringToSignV4', function (t) {
    let expected = 'AWS4-HMAC-SHA256\n' +
        '20150830T123600Z\n' +
        '20150830/us-east-1/iam/aws4_request\n' +
        'f536975d06c0309214f805bb90ccff089219ecd68b2577efef23edd43b7e1a59';

    let actual = SignerV4.buildStringToSign(
        '20150830T123600Z',
        'f536975d06c0309214f805bb90ccff089219ecd68b2577efef23edd43b7e1a59',
        '20150830',
        'us-east-1',
        'iam');

    t.equal(actual, expected, 'String to sign was constructed as expected');

    t.end();
});

test('canBuildSigningKeyV4', function (t) {
    let secretKey = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY';

    let parts = {
        date: '20150830',
        region: 'us-east-1',
        service: 'iam'
    };

    let expected = new Buffer([ 196, 175, 177, 204, 87, 113, 216, 113, 118, 58,
        57, 62, 68, 183, 3, 87, 27, 85, 204, 40, 66, 77, 26, 94, 134, 218, 110,
        211, 193, 84, 164, 185 ]);

    let actual = SignerV4.buildSigningKey(parts, secretKey);

    t.equal(
        actual.toString('hex'),
        expected.toString('hex'),
        'Signing key is created as expected'
    );

    t.end();
});

test('canBuildSignatureV4', function (t) {
    let signingKey = new Buffer([ 196, 175, 177, 204, 87, 113, 216, 113, 118, 58,
        57, 62, 68, 183, 3, 87, 27, 85, 204, 40, 66, 77, 26, 94, 134, 218, 110,
        211, 193, 84, 164, 185 ]);

    let stringToSign = 'AWS4-HMAC-SHA256\n' +
        '20150830T123600Z\n' +
        '20150830/us-east-1/iam/aws4_request\n' +
        'f536975d06c0309214f805bb90ccff089219ecd68b2577efef23edd43b7e1a59';

    let expected = '5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7';

    let actual = SignerV4.buildSignature(signingKey, stringToSign);

    t.equal(actual, expected, 'Signature was generated correctly');

    t.end();
});
