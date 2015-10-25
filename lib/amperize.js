'use strict';

var merge = require('lodash.merge')
  , EventEmitter = require('events').EventEmitter
  , emits = require('emits')
  , html = require('htmlparser2')
  , util = require('util')
  , uuid = require('node-uuid')
  , async = require('async')
  , helpers = require('./helpers');

var DEFAULTS = {
  img: {
    layout: 'responsive'
  }
};

/**
 * Amperizer constructor. Borrows from Minimize.
 *
 * https://github.com/Swaagie/minimize/blob/4b815e274a424ca89551d28c4e0dd8b06d9bbdc2/lib/minimize.js#L15
 *
 * @constructor
 * @param {Object} options Options object
 * @api public
 */
function Amperize(options) {
  this.config = merge({}, DEFAULTS, options || {});
  this.emits = emits;

  this.htmlParser = new html.Parser(
    new html.DomHandler(this.emits('read'))
  );
}

util.inherits(Amperize, EventEmitter);

/**
 * Parse the content and call the callback. Borrowed from Minimize.
 *
 * https://github.com/Swaagie/minimize/blob/4b815e274a424ca89551d28c4e0dd8b06d9bbdc2/lib/minimize.js#L51
 *
 * @param {String} content HTML
 * @param {Function} callback
 * @api public
 */
Amperize.prototype.parse = function parse(content, callback) {
  if (typeof callback !== 'function') throw new Error('No callback provided');
  var id = uuid.v4();

  this.once('read', this.amperizer.bind(this, id));
  this.once('parsed: ' + id, callback);

  this.htmlParser.parseComplete(content);
};

/**
 * Turn a traversible DOM into string content. Borrowed from Minimize.
 *
 * https://github.com/Swaagie/minimize/blob/4b815e274a424ca89551d28c4e0dd8b06d9bbdc2/lib/minimize.js#L74
 *
 * @param {Object} error
 * @param {Object} dom Traversible DOM object
 * @api private
 */
Amperize.prototype.amperizer = function amperizer(id, error, dom) {
  if (error) throw new Error('Amperizer failed to parse DOM', error);

  this.traverse(dom, '', this.emits('parsed: ' + id));
};

/**
 * Reduce the traversible DOM object to a string. Borrows from Minimize.
 *
 * https://github.com/Swaagie/minimize/blob/4b815e274a424ca89551d28c4e0dd8b06d9bbdc2/lib/minimize.js#L90
 *
 * @param {Array} data
 * @param {String} html Compiled HTML contents
 * @param {Function} done Callback function
 * @api private
 */
Amperize.prototype.traverse = function traverse(data, html, done) {
  var amperize = this;

  async.reduce(data, html, function reduce(html, element, step) {
    var children;

    function close(error, html) {
      if (error) {
        return step(error);
      }

      html += helpers.close(element);
      step(null, html);
    }

    if (element.name === 'img' && amperize.config.img) {
      element.name = 'amp-img';

      if (!element.attribs.layout) {
        element.attribs.layout = amperize.config.img.layout;
      }
    }

    children = element.children;
    html += helpers[element.type](element);

    if (!children.length) return close(null, html);

    setImmediate(function delay() {
      traverse.call(amperize, children, html, close);
    });
  }, done);
};

module.exports = Amperize;
