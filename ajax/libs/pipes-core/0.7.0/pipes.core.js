(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = accumulate;

var _streams = require("./streams");

var _utils = require("./utils");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } } // accumulate :: Function -> InitValue -> ReadableWritableBlueprint
// accumulate function takes a reducer function,
// and an optional inital value.
//
// Returns a ReadableWritableBlueprint that consumes piped
// stream, combining the values with the reducer
// and enqueues the result.
//
// reducer :: PrevValue -> CurrValue -> NextValue
// reducer function gets:
//
// PrevValue: the previous value or InitValue (if supplied)
// CurrValue: the current value being processed.
//
// that returns NextValue which in turn becomes PrevValue
// for the next iteration until the input stream is
// entirely consumed.
//

var compatibilityError = "\n    accumulate takes a reducing function\n  ";

function accumulate(reducer, init) {
  // check if reducer is a function
  if (!(0, _utils.isFunction)(reducer)) throw new Error(compatibilityError);

  var ReadableWritableBlueprint = function ReadableWritableBlueprint() {
    _classCallCheck(this, ReadableWritableBlueprint);

    // Init
    var result = init,
        readable = void 0,
        writable = void 0,
        done = void 0,
        resolved = void 0,
        rejected = void 0,
        cancelled = void 0;

    // Create done promise
    done = new Promise(function (resolve, reject) {
      resolved = resolve;
      rejected = reject;
    });

    // writable
    writable = new _streams.WritableStream({
      start: function start(err) {
        // Reject if error
        done.catch(rejected);
      },
      write: function write(chunk) {
        // if init not passed, set result as chunk
        if (result === void 0) {
          result = chunk;
          return;
        }

        // else, reduce and set result
        result = reducer(result, chunk);
      },
      close: function close() {
        resolved(result);
      },


      abort: rejected
    });

    // readable
    readable = new _streams.ReadableStream({
      start: function start(controller) {

        // Chain enqueue and done
        var finished = done.then(
        // Enqueue value if stream not cancelled
        function (val) {
          if (!cancelled) controller.enqueue(val);
        }, controller.error.bind(controller));

        // Close when finished
        finished.then(controller.close.bind(controller));
      },
      cancel: function cancel(reason) {
        // Set flag
        cancelled = true;

        // Close writable
        writable.close();

        // Resolve promise
        resolved(reason);
      }
    });

    // Return { readable, writable } pair
    Object.assign(this, {
      readable: readable, writable: writable
    });
  };

  // Return ReadableWritable blueprint if not instance


  if (this instanceof accumulate) return new ReadableWritableBlueprint();else return ReadableWritableBlueprint;
}

// Browserify compat
if (typeof module !== "undefined") module.exports = accumulate;
},{"./streams":12,"./utils":13}],2:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = chain;

var _connect = require("./connect");

var _connect2 = _interopRequireDefault(_connect);

var _utils = require("./utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// chain :: TransformStreams... -> { readable, writable }
// chain function takes one or more
// transform streams / { readable, writable } pairs
// connects them to each other,
// takes the readable of the end and the writable of the head,
// returns the { readable, writable } pair that is
// compatible with `ReadableStream::pipeThrough`
//

var compatibilityError = "\n    Only transform streams and readable-writable pairs can be chained\n  ";

function chain(origin) {

  // Check that origin is a transform stream / { readable, writable }
  if (!(0, _utils.isTransform)(origin)) throw new Error(compatibilityError);

  // connect the streams

  for (var _len = arguments.length, streams = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    streams[_key - 1] = arguments[_key];
  }

  var writable = origin.writable,
      readable = _connect2.default.apply(undefined, [origin].concat(streams));

  // Check if null stream
  if (!(0, _utils.isReadable)(readable)) throw new Error(compatibilityError);

  // return readable-writable pair
  return {
    readable: readable,
    writable: writable
  };
}

// Browserify compat
if (typeof module !== "undefined") module.exports = chain;
},{"./connect":3,"./utils":13}],3:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = connect;

var _utils = require("./utils");

function connect(origin) {
  // Check origin
  if (!origin) throw new Error("No streams passed");

  var sink = void 0,
      end = void 0;

  // Get the last stream

  for (var _len = arguments.length, streams = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    streams[_key - 1] = arguments[_key];
  }

  sink = streams.pop();

  // if origin is a transform$, take it's readable part
  end = origin.readable || origin;

  // Connect the streams
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = streams[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var stream = _step.value;


      // Check for transform streams
      if (!(0, _utils.isTransform)(stream)) throw new Error("Only transform streams allowed in the center");

      // piping through a transform returns it's readable part
      end = end.pipeThrough(stream);
    }

    // Handle sink
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  if ((0, _utils.isWritable)(sink)) end = end.pipeTo(sink);else if ((0, _utils.isTransform)(sink)) end = end.pipeThrough(sink);else throw new Error("Only writable and transform streams allowed at the end.");

  // Return result
  return end;
}

// Browserify compat
// connect :: Streams... -> ReadableStream | Promise
// connect function takes one or more streams
// and sequentially pipes them to each other,
// returning the result of the last pipe operation.
//

if (typeof module !== "undefined") module.exports = connect;
},{"./utils":13}],4:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = flatten;

var _streams = require("./streams");

var _utils = require("./utils");

// flatten :: ReadableStream... -> ReadableStream
// flatten function takes one or more streams
// and returns a readable combining the streams,
// returning chunks as they arrive in combined streams.
//

function flatten() {
  for (var _len = arguments.length, streams = Array(_len), _key = 0; _key < _len; _key++) {
    streams[_key] = arguments[_key];
  }

  var flattenedStream = void 0,
      writers = [];

  return flattenedStream = new _streams.ReadableStream({
    start: function start(controller) {
      // Create writers for each stream
      while (writers.length < streams.length) {
        writers.push(new _streams.WritableStream({
          // write incoming to flattenedStream
          write: controller.enqueue.bind(controller)
        }));
      } // Connect streams to writers
      var connect = function connect(r, w) {
        return r.pipeTo(w);
      },
          pipedAll = void 0;

      try {
        pipedAll = (0, _utils.zipWith)(connect, streams, writers);
      } catch (e) {
        throw new Error("Only readable streams can be flattened.");
      }

      // Set up closing
      return Promise.all(pipedAll).then(controller.close.bind(controller), controller.error.bind(controller));
    },
    cancel: function cancel() {
      // If cancelled, cancel all streams
      streams.forEach(function (stream) {
        return stream.cancel();
      });
    }
  });
};

// Browserify compat
if (typeof module !== "undefined") module.exports = flatten;
},{"./streams":12,"./utils":13}],5:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.split = exports.pipe = exports.merge = exports.flatten = exports.chain = exports.connect = exports.accumulate = undefined;

var _accumulate = require("./accumulate");

var _accumulate2 = _interopRequireDefault(_accumulate);

var _connect = require("./connect");

var _connect2 = _interopRequireDefault(_connect);

var _chain = require("./chain");

var _chain2 = _interopRequireDefault(_chain);

var _flatten = require("./flatten");

var _flatten2 = _interopRequireDefault(_flatten);

var _merge = require("./merge");

var _merge2 = _interopRequireDefault(_merge);

var _pipe = require("./pipe");

var _pipe2 = _interopRequireDefault(_pipe);

var _split = require("./split");

var _split2 = _interopRequireDefault(_split);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Exports
exports.accumulate = _accumulate2.default;
exports.connect = _connect2.default;
exports.chain = _chain2.default;
exports.flatten = _flatten2.default;
exports.merge = _merge2.default;
exports.pipe = _pipe2.default;
exports.split = _split2.default;

// Default exports

var fns = {
  accumulate: _accumulate2.default,
  connect: _connect2.default,
  chain: _chain2.default,
  flatten: _flatten2.default,
  merge: _merge2.default,
  pipe: _pipe2.default,
  split: _split2.default
};

// Export to window
if (typeof window !== "undefined") Object.assign(window, {
  Pipes: fns
});

exports.default = fns;
},{"./accumulate":1,"./chain":2,"./connect":3,"./flatten":4,"./merge":6,"./pipe":7,"./split":11}],6:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = merge;

var _streams = require("./streams");

// Parses arrays of {value, done} pairs to final pair
function parseResults(results) {
  var ended = false,
      values = [];

  // Accumulate values
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = results[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var _ref2 = _step.value;
      var value = _ref2.value,
          done = _ref2.done;

      ended = ended || done;
      values.push(value);
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  return {
    value: values,
    done: ended
  };
} // merge :: ReadableStream... -> ReadableStream
// merge function takes one or more streams
// and returns a readable combining the streams,
// such that it gathers chunks from all streams
// into an array and then pushes them onto the combined
// stream, by waiting for all streams to have pushed a chunk.
//

function merge() {
  for (var _len = arguments.length, streams = Array(_len), _key = 0; _key < _len; _key++) {
    streams[_key] = arguments[_key];
  }

  var readers = void 0,
      chunkWaiters = void 0,
      mergedStream = void 0,
      merger = void 0;

  // Get readers
  try {
    readers = streams.map(function (stream) {
      return stream.getReader();
    });

    // Check for transform streams
  } catch (e) {

    throw new Error("Only ReadableStreams can be flattened");
  }

  // Merging function
  merger = function merger(controller) {
    var
    // Get read promises
    promises = readers.map(function (r) {
      return r.read();
    }),
        merged = void 0,
        push = void 0;

    // Read values and push them onto the stream
    push = function push(_ref3) {
      var value = _ref3.value,
          done = _ref3.done;

      if (done) return controller.close();

      controller.enqueue(value);
    };

    // Combine values into an array
    merged = Promise.all(promises).then(parseResults).then(push, controller.error.bind(controller));

    return merged;
  };

  return mergedStream = new _streams.ReadableStream({
    start: merger,
    pull: merger,

    cancel: function cancel() {
      // If cancelled, cancel all streams
      streams.forEach(function (stream) {
        return stream.cancel();
      });
    }
  });
};

// Browserify compat
if (typeof module !== "undefined") module.exports = merge;
},{"./streams":12}],7:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = pipe;

var _utils = require("./utils");

var _pipeAsync = require("./pipeAsync");

var _pipeAsync2 = _interopRequireDefault(_pipeAsync);

var _pipeFn = require("./pipeFn");

var _pipeFn2 = _interopRequireDefault(_pipeFn);

var _pipeGen = require("./pipeGen");

var _pipeGen2 = _interopRequireDefault(_pipeGen);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// pipe :: Function | Generator Function -> Opts {} -> TransformBlueprint
// pipe takes any normal/generator func and returns transform stream blueprint.
//
// pipe.async :: Async Function -> Opts {} -> TransformBlueprint
// pipe.async takes any async func and returns transform stream blueprint.
//

function pipe(fn, opts) {
  var blueprint = void 0;

  // Route to appropriate function
  if ((0, _utils.isGeneratorFn)(fn)) blueprint = (0, _pipeGen2.default)(fn, opts);else if ((0, _utils.isFunction)(fn)) blueprint = (0, _pipeFn2.default)(fn, opts);else throw new Error("Invalid argument");

  // Return Transform blueprint if not instance
  if (this instanceof pipe) return new blueprint();else return blueprint;
}

// Add async support
pipe.async = _pipeAsync2.default;

// Browserify compat
if (typeof module !== "undefined") module.exports = pipe;
},{"./pipeAsync":8,"./pipeFn":9,"./pipeGen":10,"./utils":13}],8:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = pipeAsync;

var _streams = require("./streams");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } // pipeAsync :: Async Function -> Opts {} -> TransformBlueprint
// pipeAsync takes an async function and wraps it into
// a transform streams. Waits till completion, before enqueuing.
//
// Returns a blueprint class that can be used to
// instantiate above streams.
//

function pipeAsync(fn) {
  var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
      init = _ref.init,
      readableStrategy = _ref.readableStrategy,
      writableStrategy = _ref.writableStrategy;

  // Prepare transformer
  var transformer = {
    // Store awaiting functions
    _unfulfilledFutures: [],

    // Run function and enqueue result
    transform: function transform(chunk, controller) {
      // Run async fn
      var self = transformer,
          future = fn(chunk),
          condEnqueue = function condEnqueue(v) {
        if (v !== void 0) controller.enqueue(v);
      },


      // Get index of current future
      findex = self._unfulfilledFutures.length;

      // Add to executing futures list
      self._unfulfilledFutures.push(future);

      // Proceed to enqueue
      future.then(condEnqueue, function () {
        // Signal error to stream
        throw new Error();
      })

      // Remove itself from the _unfulfilledFutures list
      .then(function () {
        return self._unfulfilledFutures.splice(findex, 1);
      });

      return future;
    },
    flush: function flush(controller) {
      var self = transformer,
          condEnqueue = function condEnqueue(v) {
        if (v !== void 0) controller.enqueue(v);
      };

      // Check if anything is left
      Promise.all(self._unfulfilledFutures).then(function (vs) {
        return vs.map(condEnqueue);
      });
    },


    // if passed
    readableStrategy: readableStrategy,
    writableStrategy: writableStrategy
  };

  // Wrap in blueprint class

  var TransformBlueprint = function (_TransformStream) {
    _inherits(TransformBlueprint, _TransformStream);

    function TransformBlueprint() {
      var _this, _ret;

      _classCallCheck(this, TransformBlueprint);

      // Make stream
      var stream = (_this = _possibleConstructorReturn(this, (TransformBlueprint.__proto__ || Object.getPrototypeOf(TransformBlueprint)).call(this, transformer)), _this),
          writer = void 0;

      // If init, push chunk
      if (init !== void 0) {
        writer = stream.writable.getWriter();
        writer.write(init);

        // Release lock so other writers can start writing
        writer.releaseLock();
      }

      return _ret = stream, _possibleConstructorReturn(_this, _ret);
    }

    return TransformBlueprint;
  }(_streams.TransformStream);

  // Return Transform blueprint if not instance


  if (this instanceof pipeAsync) return new TransformBlueprint();else return TransformBlueprint;
}

// Browserify compat
if (typeof module !== "undefined") module.exports = pipeAsync;
},{"./streams":12}],9:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = pipeFn;

var _streams = require("./streams");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } // pipeFn :: Function -> Opts {} -> TransformBlueprint
// pipeFn takes a function and wraps it into
// a transform streams.
// Returns a blueprint class that can be used to
// instantiate above streams.
//

function pipeFn(fn) {
  var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
      init = _ref.init,
      readableStrategy = _ref.readableStrategy,
      writableStrategy = _ref.writableStrategy;

  // Prepare transformer
  var transformer = {
    // Run function and enqueue result
    transform: function transform(chunk, controller) {
      var v = fn(chunk);

      if (v !== void 0) controller.enqueue(v);
    },


    // if passed
    readableStrategy: readableStrategy,
    writableStrategy: writableStrategy
  };

  // Wrap in blueprint class

  var TransformBlueprint = function (_TransformStream) {
    _inherits(TransformBlueprint, _TransformStream);

    function TransformBlueprint() {
      var _this, _ret;

      _classCallCheck(this, TransformBlueprint);

      // Make stream
      var stream = (_this = _possibleConstructorReturn(this, (TransformBlueprint.__proto__ || Object.getPrototypeOf(TransformBlueprint)).call(this, transformer)), _this),
          writer = void 0;

      // If init, push chunk
      if (init !== void 0) {
        writer = stream.writable.getWriter();
        writer.write(init);

        // Release lock so other writers can start writing
        writer.releaseLock();
      }

      return _ret = stream, _possibleConstructorReturn(_this, _ret);
    }

    return TransformBlueprint;
  }(_streams.TransformStream);

  return TransformBlueprint;
}

// Browserify compat
if (typeof module !== "undefined") module.exports = pipeFn;
},{"./streams":12}],10:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = pipeGen;

var _streams = require("./streams");

var _utils = require("./utils");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } } // pipeGen :: Generator Function -> Opts {} -> ReadableWritableBlueprint
// pipeGen takes a generator function and wraps it into
// a transform streams. Waits till completion, before enqueuing.
// All yields are enqueued, back-pressure is respected and
// the generator paused if queue getting back-pressured.
//
// Returns a blueprint class that can be used to
// instantiate above streams.
//

var readyEvt = (0, _utils.uuid)(),
    closedProp = (0, _utils.uuid)();

// Pump function that runs the generator and adds produced values
// to the transform stream.
function pump(gen, controller, resolve) {

  // Clear queue
  _utils.events.off(readyEvt);

  // Check stream state
  var backpressure = controller.desiredSize <= 0;

  // Wait for backpressure to ease
  if (backpressure) {
    return _utils.events.on(readyEvt, function () {
      pump(gen, controller, resolve);
    });
  }

  // Ready? proceed

  // Check readable status
  var step = controller[closedProp] ? gen.return(true) : gen.next(false),
      done = step.done,
      value = step.value;

  // Enqueue
  controller.enqueue(value);

  // Generator exhausted? resolve promise
  if (done) {
    return resolve && resolve();
  }

  // Else rinse, repeat
  return pump(gen, controller, resolve);
}

function pipeGen(fn) {
  var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
      init = _ref.init,
      readableStrategy = _ref.readableStrategy,
      writableStrategy = _ref.writableStrategy;

  return function ReadableWritableBlueprint() {
    _classCallCheck(this, ReadableWritableBlueprint);

    // Init
    var readable = void 0,
        writable = void 0,
        readableReady = void 0,
        readableReady_resolve = void 0,
        readableController = void 0,
        cancelled = void 0;

    // create promise that awaits both streams to start
    readableReady = new Promise(function (resolve) {
      readableReady_resolve = resolve;
    });

    // writable
    writable = new _streams.WritableStream({
      start: function start() {
        return readableReady;
      },
      write: function write(chunk, controller) {
        var promise = void 0,
            _resolve = void 0;

        promise = new Promise(function (resolve) {
          _resolve = resolve;
        });

        // Start pump
        var gen = fn(chunk);
        pump(gen, readableController, _resolve);

        return promise;
      },
      close: function close() {
        // Signal generator to stop
        readableController[closedProp] = true;
        readableController.close();
      }
    }, writableStrategy);

    // readable
    readable = new _streams.ReadableStream({
      start: function start(controller) {
        controller[closedProp] = false;
        readableController = controller;

        // Signal writable to start
        readableReady_resolve();
      },
      pull: function pull() {
        _utils.events.trigger(readyEvt);
      },
      cancel: function cancel(reason) {
        // Close writable
        writable.abort();
      }
    }, readableStrategy);

    // If init, push chunk
    if (init !== void 0) {
      var writer = writable.getWriter();
      writer.write(init);

      // Release lock so other writers can start writing
      writer.releaseLock();
    }

    // Return { readable, writable } pair
    Object.assign(this, {
      readable: readable, writable: writable
    });
  };
}

// Browserify compat
if (typeof module !== "undefined") module.exports = pipeGen;
},{"./streams":12,"./utils":13}],11:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = split;
// split :: ReadableStream -> Int -> [ReadableStream]
// split function takes a readable stream and number
// and returns an array of tee'd readable streams,
// with a `cancelAll` function that cancels all the tee'd
// streams and hence the original stream.
//

function split(stream) {
  var parts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 2;

  // Check for readable stream
  if (!stream.tee) throw new Error("Only readable streams can be split");

  // Decls
  var result = void 0,
      cancelFns = void 0,
      cancelAll = void 0;

  // Generate parts
  result = [stream];

  while (parts > result.length) {
    // Take last part
    var s = result.pop();

    // Add new parts after tee'ing
    result = result.concat(s.tee());
  }

  // Take cancel functions
  cancelFns = result.map(function (s) {
    return s.cancel.bind(s);
  });

  // Gen cancelAll
  cancelAll = function cancelAll() {
    return cancelFns.forEach(function (c) {
      return c();
    });
  };

  // Add cancelAll to all the parts
  result.forEach(function (s) {
    s.cancelAll = cancelAll;
  });

  return result;
}

// Browserify compat
if (typeof module !== "undefined") module.exports = split;
},{}],12:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
// Access stream interface

var interfaces = void 0,
    global = global || {};

if (typeof window !== 'undefined') global = window;

if (!!global.ReadableStream) {

  interfaces = {
    ReadableStream: global.ReadableStream,
    WritableStream: global.WritableStream,
    ByteLengthQueuingStrategy: global.ByteLengthQueuingStrategy,
    CountQueuingStrategy: global.CountQueuingStrategy,
    TransformStream: global.TransformStream
  };
} else {

  try {
    interfaces = require("web-streams-polyfill");
    console.log(JSON.stringify(interfaces, null, 4));
  } catch (e) {

    throw new Error("No Stream implementation found");
  }
}

var ReadableStream = exports.ReadableStream = interfaces.ReadableStream,
    WritableStream = exports.WritableStream = interfaces.WritableStream,
    ByteLengthQueuingStrategy = exports.ByteLengthQueuingStrategy = interfaces.ByteLengthQueuingStrategy,
    CountQueuingStrategy = exports.CountQueuingStrategy = interfaces.CountQueuingStrategy,
    TransformStream = exports.TransformStream = interfaces.TransformStream;

exports.default = interfaces;
},{"web-streams-polyfill":"web-streams-polyfill"}],13:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.zipWith = zipWith;
exports.uuid = uuid;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Events
var Events = exports.Events = function () {
  function Events() {
    _classCallCheck(this, Events);

    this._events = {};
  }

  _createClass(Events, [{
    key: "trigger",
    value: function trigger(name) {
      for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }

      if (name in this._events) {
        // Trigger all handlers
        this._events[name].forEach(function (fn) {
          return fn.apply(undefined, args);
        });
      }
    }
  }, {
    key: "on",
    value: function on(name, fn) {
      this._events[name] = this._events[name] || [];
      this._events[name].push(fn);
    }
  }, {
    key: "off",
    value: function off(name) {
      this._events[name] = [];
    }
  }]);

  return Events;
}();

// Utils


var events = exports.events = new Events(),
    isTransform = exports.isTransform = function isTransform(s) {
  return s && s.writable && s.readable;
},
    isReadable = exports.isReadable = function isReadable(s) {
  return s && s.pipeThrough;
},
    isWritable = exports.isWritable = function isWritable(s) {
  return s && s.getWriter;
},


// Inspired by code from @tj/co library
isFunction = exports.isFunction = function isFunction(f) {
  return f && typeof f === "function";
},
    isGenerator = exports.isGenerator = function isGenerator(o) {
  return o && isFunction(o.next);
},
    isGeneratorFn = exports.isGeneratorFn = function isGeneratorFn(_ref) {
  var constructor = _ref.constructor;

  return constructor && (constructor.name === "GeneratorFunction" || constructor.displayName === "GeneratorFunction");
};

// Zips together two arrays using given fn
function zipWith(fn, arr1, arr2) {
  var res = [];

  // Pop values, push zipped values
  while (arr1.length && arr2.length) {
    res.push(fn(arr1.pop(), arr2.pop()));
  }return res;
}

// Generate uuids
// From: https://gist.github.com/jed/982883
function uuid(a) {
  return a ? (a ^ Math.random() * 16 >> a / 4).toString(16) : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, uuid);
}
},{}]},{},[5]);
