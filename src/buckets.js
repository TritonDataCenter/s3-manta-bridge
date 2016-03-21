var builder = require('xmlbuilder');
var config = require('../config.json');

var owner = {
    'ID': 'idval',
    'DisplayName': 'elijah'
}

module.exports = {
    listBuckets: function listBuckets(req, res, next) {
        console.log("Listing buckets");

        res.header("Content-Type", "application/xml");

        var buckets = ['bucket-01', 'bucket-02', 'bucket-03'];

        var data = {
            'ListAllMyBucketsResult': {
                '@xmlns': 'http://s3.amazonaws.com/doc/2006-03-01/',
                'Owner': owner,
                'Buckets': []
            }
        }

        buckets.forEach(function eachBucket(currentVal) {
            var node = {
                'Bucket': {
                    'Name': currentVal,
                    'CreationDate': 'dateval'
                }
            };

            data['ListAllMyBucketsResult']['Buckets'].push(node);
        });

        var xml = builder
            .create(data, {'version': '1.0', 'encoding': 'UTF-8'})
            .end({ pretty: config.prettyPrint });
        res.send(xml);
        return next();
    }
}