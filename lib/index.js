/**
 * Copyright (C) 2016 Swift Navigation Inc.
 * Contact: Joshua Gross <josh@swift-nav.com>
 * This source is subject to the license found in the file 'LICENSE' which must
 * be distributed together with this source. All other rights reserved.
 *
 * THIS CODE AND INFORMATION IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND,
 * EITHER EXPRESSED OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND/OR FITNESS FOR A PARTICULAR PURPOSE.
 */

"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var net = require('net');
var fs = require('fs');
var http = require('http');
var pkg = require('../package.json');

/**
 * Start an HTTP file-playback server.
 *
 * @param options   Object  Dictionary of options:
 *        port      Number  HTTP port to open
 *        filename  String  File to replay over HTTP
 *        chunkSize String  Size of chunk (in byte) to stream between delays
 *        delay     Number  Delay in milliseconds between sending chunks
 *        quiet     Bool    If true, don't output anything to console. Default false.
 *        repeat    Bool    If true, repeat file endlessly. Otherwise, close stream at end of file. Default true.
 * @param callback  Function(err) Callback function: called with an error,
 *   or null error when server starts and an HTTP object that can be closed.
 */
module.exports = function startHttpPlaybackServer(options, callback) {
  if ((typeof options === 'undefined' ? 'undefined' : _typeof(options)) !== 'object') {
    throw new Error('must provide options');
  }
  if (typeof callback !== 'function') {
    throw new Error('must provide callback function');
  }

  var requiredParams = ['port', 'chunkSize', 'delay'];
  for (var i in requiredParams) {
    var param = requiredParams[i];
    if (!options[param]) {
      return callback(new Error('Option must be specified: `' + param + '`'));
    }
  }

  var port = options.port;
  var filename = options.filename;
  var buffer = options.buffer;
  var chunkSize = parseInt(options.chunkSize);
  var delay = parseInt(options.delay);
  var quiet = !!options.quiet;
  var repeat = typeof options.repeat !== 'undefined' ? !!options.repeat : true;

  if (filename && buffer || !(!filename || !buffer)) {
    return callback(new Error('You must provide filename or buffer; not both.'));
  }

  // Validate that file exists.
  return fs.exists(filename, function (exists) {
    if (!exists) {
      return callback(new Error('filename does not exist for playback: ' + filename));
    }

    // Read from file and create buffer
    // Buffer.alloc / new Buffer is compat with Node 6 and below.
    var fileBuffer = buffer || (Buffer.alloc ? Buffer.alloc(0) : new Buffer([]));
    if (filename) {
      fs.createReadStream(filename).on('data', function (data) {
        fileBuffer = Buffer.concat([fileBuffer, data]);
      });
    }

    // Respond to HTTP connections being created
    function responder(req, res) {
      var index = 0;
      var interval = setInterval(function () {
        var endIndex = Math.min(index + chunkSize, fileBuffer.length);
        var nextIndex = endIndex < fileBuffer.length ? endIndex : 0;
        var buf = fileBuffer.slice(index, endIndex);

        if (nextIndex === 0 && !repeat) {
          clearInterval(interval);
          res.end(buf);
        } else {
          res.write(buf);
        }

        index = nextIndex;
      }, delay);

      req.on('close', function () {
        clearInterval(interval);
      });
    }

    // Open server on port
    if (!quiet) {
      console.log('Opening server on port', port);
    }

    return callback(null, http.createServer(responder).listen(port));
  });
};

module.exports.version = pkg.version;