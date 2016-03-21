var restify = require('restify');

var buckets = require('./buckets');

var server = restify.createServer({
    name: 's3-manta-bridge',
    version: '1.0.0',
    formatters: {
        'application/xml' : function( req, res, body, cb ) {
            if (body instanceof Error)
                return body.stack;

            if (Buffer.isBuffer(body))
                return cb(null, body.toString('base64'));

            return cb(null, body);
        }
    }
});
server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());

server.get('/', buckets.listBuckets);

server.listen(8080, function () {
    console.log('%s listening at %s', server.name, server.url);
});