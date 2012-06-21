
/**
 * Module dependencies.
 */

const mongoose = require('mongoose')
    , express = require('express')
    , assert = require('assert')
    , should = require('should')
    , Promise = mongoose.Promise
    , Schema = mongoose.Schema

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
  return this.find({ color: 'black' }).sort('_id', 1);
}

DrumsetSchema.statics.usePromise = function () {
  var promise = new Promise();
  this.find({ type: 'Acoustic' })
      .sort('_id', 1)
      .exec(promise.resolve.bind(promise));
  return promise;
}

DrumsetSchema.statics.queryError = function () {
  // should produce an invalid query error
  return this.find({ color: { $fake: { $boom: [] }} }).sort('_id', 1);
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
 * Mongoose connection helper.
 */

function connect () {
  return mongoose.createConnection('mongodb://localhost/express_goose_test');
}

/**
 * Dummy data.
 */

var db = connect();
var collection = 'drumsets_' + (Math.random() * 100000 | 0);
var Drumset = db.model('Drumset', collection);
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
  if (err) return console.error(err);
  if (--pending) return;
  db.close();
  assignExports();
}

/**
 * Creates a test server.
 */

function makeapp () {
  var app = express.createServer();
  app.set('views', __dirname + '/fixtures');
  app.set('view engine', 'jade');
  return app;
}

/**
 * DB is ready, export our expresso tests.
 */

function assignExports () {

  /**
   * Clean up the test db when finished.
   */

  var testsrunning = 4;
  function finishTest () {
    if (--testsrunning) return;
    var db = connect();
    db.once('open', function () {
      db.db.dropDatabase(function () {
        db.close();
      });
    });
  }


  exports['test render'] = function () {
    var app = makeapp();
    var db = connect();
    var Drumset = db.model('Drumset', collection);

    app.get('/renderquery', function (req, res) {
      res.render('query', {
        query: Drumset.useQuery()
      });
    });

    app.get('/renderpromise', function (req, res) {
      res.render('promise', {
        promise: Drumset.usePromise()
      });
    });

    app.get('/renderboth', function (req, res) {
      res.render('both', {
          query: Drumset.useQuery()
        , promise: Drumset.usePromise()
      });
    });

    app.get('/renderqueryerror', function (req, res) {
      res.render('query', {
        query: Drumset.queryError()
      });
    });

    app.get('/renderpromiseerror', function (req, res) {
      res.render('promise', {
        promise: Drumset.promiseError()
      });
    });

    app.get('/renderbotherror', function (req, res) {
      res.render('both', {
          query: Drumset.queryError()
        , promise: Drumset.promiseError()
      });
    });

    app.get('/renderbothnest', function (req, res) {
      res.render('both', {
          locals: {
            promise: Drumset.usePromise()
          }
        , query: Drumset.useQuery()
      });
    });

    app.get('/renderlocalsonly', function (req, res) {
      res.render('promise', {
        locals: {
          promise: Drumset.usePromise()
        }
      });
    });

    app.get('/renderlocalsonlynest', function (req, res) {
      res.render('nested', {
        locals: {
            title: 'yes'
        }
      });
    });

    app.get('/renderbothnesterror', function (req, res) {
      res.render('both', {
          locals: {
            query: Drumset.queryError()
          }
        , promise: Drumset.usePromise()
      });
    });

    // test

    var pending = 7;
    function done () {
      if (--pending) return;
      db.close();
      finishTest();
    }

    app.setMaxListeners(0);

    assert.response(app,
      { url: '/renderquery' }
    , { status: 200
      , body: '<ul><li>Roland</li></ul>'
      }
    , done
    );

    assert.response(app,
      { url: '/renderpromise' }
    , { status: 200
      , body: '<ul><li>Silver Sparkle</li></ul>'
      }
    , done
    );

    assert.response(app,
      { url: '/renderboth' }
    , { status: 200
      , body: '<ul><li>Roland</li><li>Meinl</li></ul>'
      }
    , done
    );

    assert.response(app,
      { url: '/renderbothnest' }
    , { status: 200
      , body: '<ul><li>Roland</li><li>Meinl</li></ul>'
      }
    , done
    );

    assert.response(app,
      { url: '/renderlocalsonly' }
    , { status: 200
      , body: '<ul><li>Silver Sparkle</li></ul>'
      }
    , done
    );

    assert.response(app,
      { url: '/renderlocalsonlynest' }
    , { status: 200
      , body: '<ul><li>yes</li></ul>'
      }
    , done
    );

    assert.response(app,
      { url: '/renderqueryerror' }
    , function (res) {
        assert.equal(res.statusCode, 500);
        assert.ok(~res.body.indexOf("Error: Can't use $fake with String."));
        done();
      }
    );

    assert.response(app,
      { url: '/renderpromiseerror' }
    , function (res) {
        assert.equal(res.statusCode, 500);
        assert.ok(~res.body.indexOf("Error: splat!"));
        done();
      }
    );

    assert.response(app,
      { url: '/renderbotherror' }
    , function (res) {
        assert.equal(res.statusCode, 500);
        assert.ok(~res.body.indexOf("Error: splat!"));
        done();
      }
    );

    assert.response(app,
      { url: '/renderbothnesterror' }
    , function (res) {
        assert.equal(res.statusCode, 500);
        assert.ok(~res.body.indexOf("Error: Can't use $fake with String."));
        done();
      }
    );
  };

  exports['test partial'] = function () {
    var app = makeapp();
    var db = connect();
    var Drumset = db.model('Drumset', collection);

    app.get('/partialquery', function (req, res) {
      res.partial('query', {
        query: Drumset.useQuery()
      });
    });

    app.get('/partiallocalsonly', function (req, res) {
      res.partial('promise', {
        locals: {
          promise: Drumset.usePromise()
        }
      });
    });

    app.get('/partialpromise', function (req, res) {
      res.partial('promise', {
        promise: Drumset.usePromise()
      });
    });

    app.get('/partialboth', function (req, res) {
      res.partial('both', {
          query: Drumset.useQuery()
        , promise: Drumset.usePromise()
      });
    });

    app.get('/partialqueryerror', function (req, res) {
      res.partial('query', {
        query: Drumset.queryError()
      });
    });

    app.get('/partialpromiseerror', function (req, res) {
      res.partial('promise', {
        promise: Drumset.promiseError()
      });
    });

    app.get('/partialbotherror', function (req, res) {
      res.partial('both', {
          query: Drumset.queryError()
        , promise: Drumset.promiseError()
      });
    });

    // test

    var pending = 6;
    function done () {
      if (--pending) return;
      db.close();
      finishTest();
    }

    assert.response(app,
      { url: '/partialquery' }
    , { status: 200
      , body: '<ul><li>Roland</li></ul>'
      }
    , done
    );

    assert.response(app,
      { url: '/partialpromise' }
    , { status: 200
      , body: '<ul><li>Silver Sparkle</li></ul>'
      }
    , done
    );

    assert.response(app,
      { url: '/partialboth' }
    , { status: 200
      , body: '<ul><li>Roland</li><li>Meinl</li></ul>'
      }
    , done
    );

    assert.response(app,
      { url: '/partiallocalsonly' }
    , { status: 200
      , body: '<ul><li>Silver Sparkle</li></ul>'
      }
    , done
    );

    assert.response(app,
      { url: '/partialqueryerror' }
    , function (res) {
        assert.equal(res.statusCode, 500);
        assert.ok(~res.body.indexOf("Error: Can't use $fake with String."));
        done();
      }
    );

    assert.response(app,
      { url: '/partialpromiseerror' }
    , function (res) {
        assert.equal(res.statusCode, 500);
        assert.ok(~res.body.indexOf("Error: splat!"));
        done();
      }
    );

    assert.response(app,
      { url: '/partialbotherror' }
    , function (res) {
        assert.equal(res.statusCode, 500);
        assert.ok(~res.body.indexOf("Error: splat!"));
        done();
      }
    );
  };

  exports['test send'] = function () {
    var app = makeapp();
    var db = connect();
    var Drumset = db.model('Drumset', collection);

    app.get('/sendquery', function (req, res) {
      res.send(Drumset.useQuery());
    });

    app.get('/sendpromise', function (req, res) {
      res.send(Drumset.usePromise());
    });

    app.get('/sendboth', function (req, res) {
      res.send({
          query: Drumset.useQuery()
        , promise: Drumset.usePromise()
      });
    });

    app.get('/sendqueryerror', function (req, res) {
      res.send(Drumset.queryError());
    });

    app.get('/sendpromiseerror', function (req, res) {
      res.send(Drumset.promiseError());
    });

    app.get('/sendbotherror', function (req, res) {
      res.send({
          query: Drumset.queryError()
        , promise: Drumset.promiseError()
      });
    });

    // test

    var pending = 6;
    function done () {
      if (--pending) return;
      db.close();
      finishTest();
    }

    assert.response(app,
      { url: '/sendquery' }
    , function (res) {
        done();

        assert.equal(res.statusCode, 200);
        assert.ok(/^application\/json/.test(res.headers['content-type']));

        var body = JSON.parse(res.body);

        assert.ok(!!body);
        assert.ok(Array.isArray(body));
        assert.equal(body.length, 2);
        body.forEach(function (doc) {
          assert.equal(doc.color, 'black');
        });
      }
    );

    assert.response(app,
      { url: '/sendpromise' }
    , function (res) {
        done();

        assert.equal(res.statusCode, 200);
        assert.ok(/^application\/json/.test(res.headers['content-type']));

        var body = JSON.parse(res.body);

        assert.ok(!!body);
        assert.ok(Array.isArray(body));
        assert.equal(body.length, 3);
        body.forEach(function (doc) {
          assert.equal(doc.type, 'Acoustic');
        });
      }
    );

    assert.response(app,
      { url: '/sendboth' }
    , function (res) {
        done();

        assert.equal(res.statusCode, 200);
        assert.ok(/^application\/json/.test(res.headers['content-type']));

        var body = JSON.parse(res.body);

        assert.ok(!!body);
        assert.equal(body.query.length, 2);
        assert.equal(body.promise.length, 3);
      }
    );

    assert.response(app,
      { url: '/sendqueryerror' }
    , function (res) {
        done();
        assert.equal(res.statusCode, 500);
        assert.ok(~res.body.indexOf("Error: Can't use $fake with String."));
      }
    );

    assert.response(app,
      { url: '/sendpromiseerror' }
    , function (res) {
        done();
        assert.equal(res.statusCode, 500);
        assert.ok(~res.body.indexOf("Error: splat!"));
      }
    );

    assert.response(app,
      { url: '/sendbotherror' }
    , function (res) {
        done();
        assert.equal(res.statusCode, 500);
        assert.ok(~res.body.indexOf("Error: splat!"));
      }
    );
  };

  exports.redirect = function () {
    var app = makeapp();
    var db = connect();
    var Drumset = db.model('Drumset', collection);

    app.get('/redirect', function (req, res) {
      res.redirect('/sound');
    });

    app.get('/redirect/status', function (req, res) {
      res.redirect('/sound', 301);
    });

    app.get('/redirectpromise', function (req, res) {
      res.redirect(Drumset.usePromiseRedirect());
    });

    app.get('/redirectpromise/status', function (req, res) {
      res.redirect(Drumset.usePromiseRedirect(), 301);
    });

    app.get('/redirectpromisestatus', function (req, res) {
      res.redirect(Drumset.usePromiseRedirect(301));
    });

    app.get('/redirectpromisestatus/override', function (req, res) {
      res.redirect(Drumset.usePromiseRedirect(301), 500);
    });

    app.get('/redirectpromiseerror', function (req, res) {
      res.redirect(Drumset.promiseError());
    });

    // test

    var pending = 7;
    function done () {
      if (--pending) return;
      db.close();
      finishTest();
    }

    assert.response(app,
      { url: '/redirect' }
    , function (res) {
        done();
        assert.equal(res.statusCode, 302);
        assert.ok('/sound', res.headers['Location']);
      }
    );

    assert.response(app,
      { url: '/redirect/status' }
    , function (res) {
        done();
        assert.equal(res.statusCode, 301);
        assert.ok('/sound', res.headers['Location']);
      }
    );

    assert.response(app,
      { url: '/redirectpromise' }
    , function (res) {
        done();
        assert.equal(res.statusCode, 302);
        assert.ok('/redirect/promise', res.headers['Location']);
      }
    );

    assert.response(app,
      { url: '/redirectpromise/status' }
    , function (res) {
        done();
        assert.equal(res.statusCode, 301);
        assert.ok('/redirect/promise', res.headers['Location']);
      }
    );

    assert.response(app,
      { url: '/redirectpromisestatus' }
    , function (res) {
        done();
        assert.equal(res.statusCode, 301);
        assert.ok('/redirect/promise', res.headers['Location']);
      }
    );

    assert.response(app,
      { url: '/redirectpromisestatus/override' }
    , function (res) {
        done();
        assert.equal(res.statusCode, 301);
        assert.ok('/redirect/promise', res.headers['Location']);
      }
    );

    assert.response(app,
      { url: '/redirectpromiseerror' }
    , function (res) {
        done();
        assert.equal(res.statusCode, 500);
        assert.ok(/splat!/.test(res.body));
      }
    );
  }
}
