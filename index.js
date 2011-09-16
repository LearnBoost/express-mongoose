/*!
 * Express-mongoose
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licenced
 */

/**
 * Version.
 */

exports.version = '0.0.4';

/**
 * Module dependencies.
 */

const res = require('http').ServerResponse.prototype
    , Promise = require('mongoose').Promise
    , Query = require('mongoose').Query;

/**
 * Wrap the original rendering methods with support
 * for Queries and Promises.
 */

res.render = wrap(res.render);
res.partial = wrap(res.partial);

function wrap (method) {
  return function expressmongoose (view, options, callback, parent, sub) {

    if (!options || 'function' == typeof options) {
      return method.call(this, view, options, callback, parent, sub);
    }

    var self = this;
    return resolve(options, function (err, result) {
      if (err) {
        return 'function' == typeof callback
          ? callback(err)
          : self.req.next(err);
      }

      // must return here so partials always work
      return method.call(self, view, result, callback, parent, sub);
    });
  }
}

/**
 * Resolves any Queries and Promises within the passed options.
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
      item.run(handleResult);
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

/**
 * Add Promise/Query support to res.send.
 */

var oldsend = res.send;

res.send = function (body, headers, status) {
  var self = this;

  function handleResult (err, result) {
    if (err) return self.req.next(err);
    oldsend.call(self, result, headers, status);
  }

  if (body instanceof Promise) {
    return body.addBack(handleResult);
  }

  if (body instanceof Query) {
    return body.run(handleResult);
  }

  if ('Object' == body.constructor.name) {
    return resolve(body, handleResult);
  }

  oldsend.call(this, body, headers, status);
};
