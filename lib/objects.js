/**
 * S3 Object operations
 *
 * @module objects
 */
"use strict";

var mod_util = require('util');
var options;

function AddObject(req, res, next) {
    console.log("adding object: %s", mod_util.inspect(req.params));

    res.send(200);
    return next();
}

module.exports = function (_options) {
    options = _options;

    return {
        addObject: AddObject
    };
};
