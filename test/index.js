
/**
 * Module dependencies.
 */

const mongoose = require('mongoose')
    , express = require('express')
    , assert = require('assert')
    , Promise = mongoose.Promise
    , Schema = mongoose.Schema
    , http = require('http')
    , request = require('superagent')

require('../');

/**
 * Schema definition.
 */

var DrumsetSchema = new Schema({
    brand: String
  , color: String
  , type:  String
  , model: String
});

/**
 * Schema methods.
 */

DrumsetSchema.statics.useQuery = function () {
  // return a Query
  return this.find({ color: 'black' }).sort('_id');
}

DrumsetSchema.statics.usePromise = function () {
  var promise = new Promise();
  this.find({ type: 'Acoustic' })
      .sort('_id')
      .exec(promise.resolve.bind(promise));
  return promise;
}

DrumsetSchema.statics.queryError = function () {
  // should produce an invalid query error
  return this.find({ color: { $fake: { $boom: [] }} }).sort('_id');
}

DrumsetSchema.statics.promiseError = function () {
  var promise = new Promise;
  promise.error(new Error('splat!'));
  return promise;
}

DrumsetSchema.statics.usePromiseRedirect = function (status) {
  var url = '/promise/redirect';
  var promise = new Promise;
  process.nextTick(function () {
    promise.complete(url, status);
  });
  return promise;
}

mongoose.model('Drumset', DrumsetSchema);

/**
 * Creates a test server.
 */

function makeapp () {
  var app = express();
  app.set('views', __dirname + '/fixtures');
  app.set('view engine', 'jade');
  return app;
}

/**
 * Mongoose connection helper.
 */

function connect () {
  return mongoose.createConnection('mongodb://localhost/express_goose_test');
}

describe('express-mongoose', function(){
  var collection = 'drumsets_' + (Math.random() * 100000 | 0);
  var db, Drumset;

  before(function(done){
    // add dummy data
    db = connect();
    Drumset = db.model('Drumset', collection);
    var pending = 4;

    Drumset.create({
        brand: 'Roland'
      , color: 'black'
      , type: 'electronic'
      , _id: '4da8b662057a83596c000001'
    }, added);

    Drumset.create({
        brand: 'GMS'
      , color: 'Silver Sparkle'
      , type: 'Acoustic'
      , _id: '4da8b662057a83596c000002'
    }, added);

    Drumset.create({
        brand: 'DW'
      , color: 'Broken Glass'
      , type: 'Acoustic'
      , _id: '4da8b662057a83596c000003'
    }, added);

    Drumset.create({
        brand: 'Meinl'
      , color: 'black'
      , type: 'Acoustic'
      , _id: '4da8b662057a83596c000004'
    }, added);

    function added (err) {
      if (added.err) return;

      if (err) {
        db.close();
        return done(added.err = err);
      }

      if (--pending) return;
      done();
    }
  })

  after(function(done){
    // clean up the test db
    db.db.dropDatabase(function () {
      db.close();
      done();
    });
  })

  function test (routes, next) {
    var app = makeapp();

    Object.keys(routes).forEach(function (route) {
      app.get(route, routes[route]);
    })

    // error handler
    app.use(function (err, req, res, next) {
      res.statusCode = 500;
      res.send(err.stack);
    })

    var server = http.Server(app);
    var address;

    before(function (done) {
      server.listen(0, function () {
        address = server.address();
        done();
      });
    });

    after(function (done) {
      server.close();
      done();
    })

    next(function req (path, cb) {
      var url = 'http://' + address.address + ':' + address.port + path;
      return request.get(url, cb);
    })
  }

  describe('render', function(){
    var routes = {};

    routes['/renderquery'] = function (req, res) {
      res.render('query', {
        query: Drumset.useQuery()
      });
    }

    routes['/renderpromise'] = function (req, res) {
      res.render('promise', {
        promise: Drumset.usePromise()
      });
    }

    routes['/renderboth'] = function (req, res) {
      res.render('both', {
          query: Drumset.useQuery()
        , promise: Drumset.usePromise()
      });
    }

    routes['/renderqueryerror'] = function (req, res) {
      res.render('query', {
        query: Drumset.queryError()
      });
    }

    routes['/renderpromiseerror'] = function (req, res) {
      res.render('promise', {
        promise: Drumset.promiseError()
      });
    }

    routes['/renderbotherror'] = function (req, res) {
      res.render('both', {
          query: Drumset.queryError()
        , promise: Drumset.promiseError()
      });
    }

    routes['/renderlocalsonlynest'] = function (req, res) {
      res.render('nested', {
        title: 'yes'
      });
    }

    test(routes, function (req) {
      it('/renderquery', function(done){
        req('/renderquery', function (res) {
          assert.equal(200, res.status);
          assert.equal('<ul><li>Roland</li></ul>', res.text);
          done();
        })
      })

      it('/renderpromise', function(done){
        req('/renderpromise', function (res) {
          assert.equal(200, res.status);
          assert.equal('<ul><li>Silver Sparkle</li></ul>', res.text);
          done();
        })
      })

      it('/renderboth', function(done){
        req('/renderboth', function (res) {
          assert.equal(200, res.status);
          assert.equal('<ul><li>Roland</li><li>Meinl</li></ul>', res.text);
          done();
        })
      })

      it('/renderlocalsonlynest', function(done){
        req('/renderlocalsonlynest', function (res) {
          assert.equal(200, res.status);
          assert.equal('<ul><li>yes</li></ul>', res.text);
          done();
        })
      })

      it('/renderqueryerror', function(done){
        req('/renderqueryerror', function (res) {
          assert.equal(500, res.status);
          assert.ok(~res.text.indexOf("Error: Can't use $fake with String."));
          done();
        })
      })

      it('/renderpromiseerror', function(done){
        req('/renderpromiseerror', function (res) {
          assert.equal(500, res.status);
          assert.ok(~res.text.indexOf("Error: splat!"));
          done();
        });
      })

      it('/renderbotherror', function(done){
        req('/renderbotherror', function (res) {
          assert.equal(500, res.status);
          assert.ok(~res.text.indexOf("Error: splat!"));
          done();
        });
      })
    })
  })

  describe('send', function(){
    var routes = {}

    routes['/sendquery'] = function (req, res) {
      res.send(Drumset.useQuery());
    }

    routes['/sendpromise'] = function (req, res) {
      res.send(Drumset.usePromise());
    }

    routes['/sendboth'] = function (req, res) {
      res.send({
          query: Drumset.useQuery()
        , promise: Drumset.usePromise()
      });
    }

    routes['/sendqueryerror'] = function (req, res) {
      res.send(Drumset.queryError());
    }

    routes['/sendpromiseerror'] = function (req, res) {
      res.send(Drumset.promiseError());
    }

    routes['/sendbotherror'] = function (req, res) {
      res.send({
          query: Drumset.queryError()
        , promise: Drumset.promiseError()
      });
    }

    routes['/sendnothing'] = function(req, res) {
      res.send();
    }

    test(routes, function (req) {
      it('/sendquery', function(done){
        req('/sendquery', function (res) {
          assert.equal(res.status, 200);
          assert.ok(/^application\/json/.test(res.headers['content-type']));

          var body = JSON.parse(res.text);

          assert.ok(!!body);
          assert.ok(Array.isArray(body));
          assert.equal(body.length, 2);
          body.forEach(function (doc) {
            assert.equal(doc.color, 'black');
          });

          done();
        })
      })

      it('/sendpromise', function (done) {
        req('/sendpromise', function (res) {
          assert.equal(res.status, 200);
          assert.ok(/^application\/json/.test(res.headers['content-type']));

          var body = JSON.parse(res.text);

          assert.ok(!!body);
          assert.ok(Array.isArray(body));
          assert.equal(body.length, 3);
          body.forEach(function (doc) {
            assert.equal(doc.type, 'Acoustic');
          });

          done();
        })
      })

      it('/sendboth', function (done) {
        req('/sendboth', function (res) {
          assert.equal(res.status, 200);
          assert.ok(/^application\/json/.test(res.headers['content-type']));

          var body = JSON.parse(res.text);

          assert.ok(!!body);
          assert.equal(body.query.length, 2);
          assert.equal(body.promise.length, 3);

          done();
        })
      })

      it('/sendqueryerror', function(done){
        req('/sendqueryerror', function (res) {
          assert.equal(res.status, 500);
          assert.ok(~res.text.indexOf("Error: Can't use $fake with String."));
          done();
        });
      })

      it('/sendpromiseerror', function(done){
        req('/sendpromiseerror', function (res) {
          assert.equal(res.status, 500);
          assert.ok(~res.text.indexOf("Error: splat!"));
          done();
        });
      })

      it('/sendbotherror', function(done){
        req('/sendbotherror', function (res) {
          assert.equal(res.statusCode, 500);
          assert.ok(~res.text.indexOf("Error: splat!"));
          done();
        })
      })

      it('/sendnothing', function(done){
        req('/sendnothing', function (res) {
          assert.equal(res.statusCode, 200);
          done();
        })
      })
    })
  })

  describe('redirect', function(){
    var routes = {};

    routes['/redirect'] = function (req, res) {
      res.redirect('/sound');
    }

    routes['/redirect/status'] = function (req, res) {
      res.redirect(301, '/sound');
    }

    routes['/redirectpromise'] = function (req, res) {
      res.redirect(Drumset.usePromiseRedirect());
    }

    routes['/redirectpromise/status'] = function (req, res) {
      res.redirect(Drumset.usePromiseRedirect(), 301);
    }

    routes['/redirectpromisestatus'] = function (req, res) {
      res.redirect(Drumset.usePromiseRedirect(301));
    }

    routes['/redirectpromisestatus/override'] = function (req, res) {
      res.redirect(Drumset.usePromiseRedirect(301), 500);
    }

    routes['/redirectpromiseerror'] = function (req, res) {
      res.redirect(Drumset.promiseError());
    }

    test(routes, function (req) {
      it('/redirect' , function (done) {
        var r = req('/redirect');
        r.redirects(0).end(function (res) {
          assert.equal(res.statusCode, 302);
          assert.ok(/\/sound$/.test(res.headers['location']));
          done();
        })
      })

      it('/redirect/status',function (done) {
        var r = req('/redirect/status');
        r.redirects(0).end(function (res) {
          assert.equal(res.statusCode, 301);
          assert.ok(/\/sound$/.test(res.headers['location']));
          done();
        })
      })

      it('/redirectpromise',function (done) {
        var r = req('/redirectpromise');
        r.redirects(0).end(function (res) {
          assert.equal(res.statusCode, 302);
          assert.ok(/\/promise\/redirect$/.test(res.headers['location']));
          done();
        })
      })

      it('/redirectpromise/status',function (done) {
        var r = req('/redirectpromise/status');
        r.redirects(0).end(function (res) {
          assert.equal(res.statusCode, 301);
          assert.ok(/\/promise\/redirect$/.test(res.headers['location']));
          done();
        })
      })

      it('/redirectpromisestatus',function (done) {
        var r = req('/redirectpromisestatus');
        r.redirects(0).end(function (res) {
          assert.equal(res.statusCode, 301);
          assert.ok(/\/promise\/redirect$/.test(res.headers['location']));
          done();
        });
      });

      it('/redirectpromisestatus/override',function (done) {
        var r = req('/redirectpromisestatus/override');
        r.redirects(0).end(function (res) {
          assert.equal(res.statusCode, 301);
          assert.ok(/\/promise\/redirect$/.test(res.headers['location']));
          done();
        })
      })

      it('/redirectpromiseerror',function (done) {
        var r = req('/redirectpromiseerror');
        r.redirects(0).end(function (res) {
          assert.equal(res.statusCode, 500);
          assert.ok(/splat!/.test(res.text));
          done();
        })
      })
    })
  })
})

