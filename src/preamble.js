/*
  backgrid
  http://github.com/wyuenho/backgrid

  Copyright (c) 2013 Jimmy Yuen Ho Wong and contributors
  Licensed under the MIT license.
*/

// Copyright 2009, 2010 Kristopher Michael Kowal
// https://github.com/kriskowal/es5-shim
// ES5 15.5.4.20
// http://es5.github.com/#x15.5.4.20
var ws = "\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003" +
  "\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028" +
  "\u2029\uFEFF";
if (!String.prototype.trim || ws.trim()) {
  // http://blog.stevenlevithan.com/archives/faster-trim-javascript
  // http://perfectionkills.com/whitespace-deviations/
  ws = "[" + ws + "]";
  var trimBeginRegexp = new RegExp("^" + ws + ws + "*"),
  trimEndRegexp = new RegExp(ws + ws + "*$");
  String.prototype.trim = function trim() {
    if (this === undefined || this === null) {
      throw new TypeError("can't convert " + this + " to object");
    }
    return String(this)
      .replace(trimBeginRegexp, "")
      .replace(trimEndRegexp, "");
  };
}

function lpad(str, length, padstr) {
  var paddingLen = length - (str + '').length;
  paddingLen =  paddingLen < 0 ? 0 : paddingLen;
  var padding = '';
  for (var i = 0; i < paddingLen; i++) {
    padding = padding + padstr;
  }
  return padding + str;
}

var $ = Backbone.$;

var Backgrid = root.Backgrid = {

  Extension: {},

  resolveNameToClass: function (name, suffix) {
    if (_.isString(name)) {
      var key = _.map(name.split('-'), function (e) {
        return e.slice(0, 1).toUpperCase() + e.slice(1);
      }).join('') + suffix;
      var klass = Backgrid[key] || Backgrid.Extension[key];
      if (_.isUndefined(klass)) {
        throw new ReferenceError("Class '" + key + "' not found");
      }
      return klass;
    }

    return name;
  },

  callByNeed: function () {
    var value = arguments[0];
    if (!_.isFunction(value)) return value;

    var context = arguments[1];
    var args = [].slice.call(arguments, 2);
    return value.apply(context, !!(args + '') ? args : void 0);
  }

};
_.extend(Backgrid, Backbone.Events);

/**
   Command translates a DOM Event into commands that Backgrid
   recognizes. Interested parties can listen on selected Backgrid events that
   come with an instance of this class and act on the commands.

   It is also possible to globally rebind the keyboard shortcuts by replacing
   the methods in this class' prototype.

   @class Backgrid.Command
   @constructor
 */
var Command = Backgrid.Command = function (evt) {
  _.extend(this, {
    altKey: !!evt.altKey,
    "char": evt["char"],
    charCode: evt.charCode,
    ctrlKey: !!evt.ctrlKey,
    key: evt.key,
    keyCode: evt.keyCode,
    locale: evt.locale,
    location: evt.location,
    metaKey: !!evt.metaKey,
    repeat: !!evt.repeat,
    shiftKey: !!evt.shiftKey,
    which: evt.which
  });
};
_.extend(Command.prototype, {
  /**
     Up Arrow

     @member Backgrid.Command
   */
  moveUp: function () { return this.keyCode == 38; },
  /**
     Down Arrow

     @member Backgrid.Command
   */
  moveDown: function () { return this.keyCode === 40; },
  /**
     Shift Tab

     @member Backgrid.Command
   */
  moveLeft: function () { return this.shiftKey && this.keyCode === 9; },
  /**
     Tab

     @member Backgrid.Command
   */
  moveRight: function () { return !this.shiftKey && this.keyCode === 9; },
  /**
     Enter

     @member Backgrid.Command
   */
  save: function () { return this.keyCode === 13; },
  /**
     Esc

     @member Backgrid.Command
   */
  cancel: function () { return this.keyCode === 27; },
  /**
     None of the above.

     @member Backgrid.Command
   */
  passThru: function () {
    return !(this.moveUp() || this.moveDown() || this.moveLeft() ||
             this.moveRight() || this.save() || this.cancel());
  }
});

Backgrid.mount = function (childView, parentView, options) {
  var el = parentView.el, children = el.childNodes;
  options = _.defaults(options || {}, {at: children.length});
  childView.preRender();
  if (options.at >= children.length) el.appendChild(childView.render().el);
  else el.insertBefore(childView, children[options.at]);
  parentView.delegateEvents();
  childView.postRender();
};

var matchesSelector = (function () {
  var matches = Element.prototype.matches;
  if (!matches) {
    var prefixes = ["webkit", "moz", "ms", "o"];
    for (var i = 0, l = prefixes.length; i < l; i++) {
      var method = Element.prototype[prefixes[i] + "MatchesSelector"];
      if (method) {
        matches = method;
        break;
      }
    }
  }

  return matches;
}());

var delegateEventSplitter = /^(\S+)\s*(.*)$/;

var View = Backgrid.View = Backbone.View.extend({

  useNative: true,

  _domEventListeners: {},

  $: function (selector) {
    return this.useNative ?
        this.el.querySelectorAll(selector) :
        View.__super__.$.apply(this, arguments);
  },

  preRender: function () {
    return this;
  },

  postRender: function () {
    return this;
  },

  show: function () {
    delete this.el.style.display;
    return this;
  },

  hide: function () {
    this.el.style.display = "none";
    return this;
  },

  empty: function () {
    if (this.useNative) {
      var el = this.el;
      while (el.firstChild) el.removeChild(el.firstChild);
    }
    else this.$el.empty();
    return this;
  },

  remove: function () {
    if (this.useNative) {
      this.undelegateEvents();
      var el = this.el;
      var parentNode = el.parentNode;
      if (parentNode) parentNode.removeChild(el);
      this.stopListening();
    }
    else return View.__super__.remove.apply(this, arguments);
    return this;
  },

  setElement: function(element, delegate) {
    if (this.useNative) {
      if (this.el) this.undelegateEvents();
      if (typeof element == 'string') {
        if (element.trim()[0] == '<') {
          var el = document.createElement("div");
          el.innerHTML = element;
          this.el = el.firstChild;
        }
        else this.el = document.querySelector(element.trim());
      }
      else this.el = element;
      if (delegate !== false) this.delegateEvents();
    } else View.__super__.setElement.apply(this, arguments);
    return this;
  },

  delegateEvents: function (events) {
    if (this.useNative) {
      if (!(events || (events = _.result(this, 'events')))) return this;
      this.undelegateEvents();
      var eventSelectorMethodMap = {};
      for (var key in events) {
        var method = events[key];
        if (!_.isFunction(method)) method = this[events[key]];
        if (!method) continue;

        var match = key.match(delegateEventSplitter);
        var eventName = match[1], selector = match[2];
        method = _.bind(method, this);

        var selectors = eventSelectorMethodMap[eventName];
        if (!selectors) selectors = eventSelectorMethodMap[eventName] = {};

        var methods = selectors[selector];
        if (!methods) methods = selectors[selector] = [];

        methods.push(method);
      }

      var el = this.el, domEventListeners = this._domEventListeners;

      for (var eventName in eventSelectorMethodMap) {
        var listener = domEventListeners[eventName] = (function (eventName) {
          return function (e) {
            var target = e.target;
            if (target) {
              for (var selector in eventSelectorMethodMap[eventName]) {
                if (selector === '' || matchesSelector.call(target, selector)) {
                  var methods = eventSelectorMethodMap[eventName][selector];
                  for (var i = 0, l = methods.length; i < l; i++) {
                    var result = methods[i].apply(this, arguments);
                    if (result === false) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }
                }
              }
            }
          };
        }(eventName));

        el.addEventListener(eventName, listener, false);
      }

    }
    else View.__super__.delegateEvents.apply(this, arguments);
    return this;
  },

  undelegateEvents: function () {
    var el = this.el;
    if (el && this.useNative) {
      var domEventListeners = this._domEventListeners;
      for (var eventName in domEventListeners) {
        el.removeEventListener(eventName, domEventListeners[eventName], false);
      }
      this._domEventListeners = {};
    }
    else View.__super__.undelegateEvents.apply(this, arguments);
    return this;
  },

  _ensureElement: function () {
    if (!this.el) {
      var el = this.el = document.createElement(_.result(this, 'tagName'));
      var attrs = _.extend({}, _.result(this, 'attributes'));
      if (this.id) attrs.id = _.result(this, 'id');
      if (this.className) attrs['class'] = _.result(this, 'className');
      for (var k in attrs) {
        el.setAttribute(k, attrs[k]);
      }
      this.setElement(el, false);
    } else {
      this.setElement(_.result(this, 'el'), false);
    }
  }

});
