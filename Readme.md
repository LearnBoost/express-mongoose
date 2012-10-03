<img src="https://github.com/LearnBoost/express-mongoose/raw/master/express-mongoose.png"/>

Adds [Mongoose](http://mongoosejs.com) [Query](http://mongoosejs.com/docs/api.html#query-js) and [Promise](http://mongoosejs.com/docs/api.html#promise-js) support to [Express](http://expressjs.com).

Methods which now support `Promises`:

   - `res.render`
   - `res.send`
   - `res.redirect`

Methods which now support `Queries`:

   - `res.render`
   - `res.send`

## Installation

    $ npm install express-mongoose

### Example

In your schemas:

    UserSchema.methods.getLikes = function (callback) {
      // returns a Query
      return this.model('Likes').find({ _user: this._id }, callback);
    };

    NewsSchema.statics.getLatest = function (callback) {
      var promise = new Promise;
      if (callback) promise.addBack(callback);
      this.find({ datePublished: { $gt: new Date(Date.now() - 60000*60) } }, promise.resolve.bind(promise));
      return promise;
    };

In your routes:

    app.get('/dashboard', function (req, res) {
      var News = db.model('News');

      // render support
      res.render('dashboard', {
          likes: req.user.getLikes()
        , latestNews: News.getLatest()
        , stuff: new Promise(somethingAsync)
      });
    });

With `res.send` support you can pass a `Query` or `Promise` and the result will be rendered as json.
If an error occurs, the error will be passed to `next()` as expected.

    app.get('/send', function (req, res) {
      var News = db.model('News');
      res.send(News.getLatest());
    });

    app.get('/promises', function (req, res) {
      var promise = new Promise(somethingAsync);
      res.send(promise);
    });

    app.get('/more', function (req, res) {
      res.send({
          promise: new Promise(somethingAsync)
        , news: req.user.getLatest()
      });
    });

`res.redirect` accepts a `Promise` as well.

    app.get('/redirect', function (req, res) {
      var promise = new Promise;
      res.redirect(promise);

      process.nextTick(function () {
        promise.complete(url [, status]);
        // or
        promise.error(new Error('uh oh'));
      });
    });

### Error handling

 If a `Query` or `Promise` resolves to an error it will be forwarded on with `next(err)` as expected.

### Compatibility

```
Express >=3.x use >= 0.1.0
Express < 3.x use <  0.1.0

Mongoose: >= 1.x
MongoDB: any
```

## Authors

  - [Aaron Heckmann (aheckmann)](http://github.com/aheckmann)

## License

(The MIT License)

Copyright (c) 2011 LearnBoost &lt;dev@learnboost.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
