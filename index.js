/*!
 * Express-mongoose
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licenced
 */

/**
 * Version.
 */

exports.version = JSON.parse(require('fs').readFileSync(__dirname + '/package.json')).version;

/**
 * Module dependencies.
 */

var express = require('express')
  , Promise = require('mongoose').Promise
  , Query = require('mongoose').Query
  , slice = require('sliced')

/**
 * Wrap response.render with support for mongoose
 * Queries and Promises.
 */

var render = express.response.render;
express.response.render = function expressmongoose_render (view, options, callback) {
  if (!options || 'function' == typeof options) {
    return render.call(this, view, options, callback);
  }

  var self = this;
  return resolve(options, function (err, result) {
    if (err) {
      return 'function' == typeof callback
        ? callback(err)
        : self.req.next(err);
    }

    // must return here so partials always work
    return render.call(self, view, result, callback);
  });
}

/**
 * Add Promise/Query support to res.send.
 */

var send = express.response.send;
express.response.send = function expressmongoose_send () {
  var args = slice(arguments);
  var self = this;

  function handleResult (err, result) {
    if (err) return self.req.next(err);
    args[0] = result;
    send.apply(self, args);
  }

  if (args[0] instanceof Promise) {
    return args[0].addBack(handleResult);
  }

  if (args[0] instanceof Query) {
    return args[0].exec(handleResult);
  }

  if ('Object' == args[0].constructor.name) {
    return resolve(args[0], handleResult);
  }

  send.apply(this, args);
};

/**
 * Extends res.redirect with mongoose Promise support.
 *
 * Does not accept Queries since those return documents.
 * Instead, manually handle the result of your query first,
 * then resolve your promise with the url and optional status.
 *
 *     var promise = new mongoose.Promise;
 *     res.redirect(promise);
 *
 *     // later...
 *     promise.complete(url [, status]);
 *
 * The promise may pass an optional status code as the
 * first argument.
 *
 *     promise.complete(301, '/elsewhere');
 */

var redirect = express.response.redirect;
express.response.redirect = function expressmongoose_redirect () {
  var self = this;
  var args = slice(arguments);

  function handleResult (err, url, code) {
    if (err) return self.req.next(err);

    if ('string' != typeof url) {
      return self.req.next(new Error('URL Expected'));
    }

    args[0] = url;
    if (code) args[1] = code;
    redirect.apply(self, args);
  }

  if (args[0] instanceof Promise) {
    return args[0].addBack(handleResult);
  }

  redirect.apply(this, args);
}

// TODO res.json
// TODO res.jsonp

/**
 * Resolves any Queries and Promises within the passed options.
 * @api private
 */

function resolve (options, callback, nested) {
  var keys = Object.keys(options)
    , i = keys.length
    , remaining = []
    , pending
    , item
    , key;

  while (i--) {
    key = keys[i];
    item = options[key];
    if (item instanceof Query || item instanceof Promise) {
      item.key = key;
      remaining.push(item);
    }
  }

  pending = remaining.length;
  if (options.locals) ++pending;

  if (!pending) {
    return callback(null, options);
  }

  function error (err) {
    if (error.ran) return;
    callback(error.ran = err);
  }

  remaining.forEach(function (item) {
    function handleResult (err, result) {
      if (err) return error(err);
      options[item.key] = result;
      --pending || callback(null, options);
    }

    if (item instanceof Query) {
      item.exec(handleResult);
    } else {
      item.addBack(handleResult);
    }
  });

  if (nested) return;

  // locals support
  if (options.locals) {
    return resolve(options.locals, function (err, resolved) {
      if (err) return error(err);
      options.locals = resolved;
      if (--pending) return;
      return callback(null, options);
    }, true);
  }
}

