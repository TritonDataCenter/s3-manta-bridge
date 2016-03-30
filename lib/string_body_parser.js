"use strict";

function parse(req, res, options, next) {
    if (req.body !== undefined) {
        return next();
    }

    var maxRequestSize = options.maxRequestBodySize;
    var totalBytes = 0;

    var buffer = []
    var err;

    req.on('data', function onRequestData(chunk) {
        /* We test to make sure that no one can send requests larger than the
         * configured size. */
        if (chunk.length + totalBytes > maxRequestSize) {
            err = new Error('The request body was too large.');
            err.statusCode = 413;
            err.restCode = 'RequestEntityTooLarge';
            req.emit('end');
            return;
        } else {
            totalBytes += chunk.length;
            buffer.push(chunk);
        }
    });

    req.once('end', function() {
        if (err) {
            return next(err);
        }

        var concatenated = Buffer.concat(buffer);
        req.body = concatenated.toString('utf8');
        return next();
    });
}

module.exports = {
    parse: parse
};
