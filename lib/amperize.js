'use strict';

var merge = require('lodash.merge')
  , EventEmitter = require('events').EventEmitter
  , emits = require('emits')
  , html = require('htmlparser2')
  , util = require('util')
  , uuid = require('node-uuid')
  , async = require('async')
  , url = require('url')
  , http = require('http')
  , https = require('https')
  , sizeOf = require('image-size')
  , helpers = require('./helpers');

var DEFAULTS = {
  img: {
    layout: 'responsive',
    width: 600,
    height: 400,
  },
  iframe: {
    layout: 'responsive',
    width: 600,
    height: 400,
    sandbox: 'allow-scripts allow-same-origin'
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

    function enter(error) {
      if (error) {
        return done(error);
      }

      children = element.children;
      html += helpers[element.type](element);

      if (!children || !children.length) return close(null, html);

      setImmediate(function delay() {
        traverse.call(amperize, children, html, close);
      });
    }

    /**
     * Get the image sizes (width and heigth plus type of image)
     *
     * https://github.com/image-size/image-size
     *
     * @param {Object} element
     * @return {Object} element incl. width and height
     */
    function getImageSize(element) {
      var options = url.parse(element.attribs.src);
      var request = element.attribs.src.indexOf('https') === 0 ? https : http;

      // We need the user-agent, otherwise some https request may fail (e. g. cloudfare)
      options.headers = { 'User-Agent': 'Mozilla/5.0' };

      return request.get(options, function (response) {
        var chunks = [];
        response.on('data', function (chunk) {
          chunks.push(chunk);
        }).on('end', function () {
            try {
                var dimensions = sizeOf(Buffer.concat(chunks));
                element.attribs.width = dimensions.width;
                element.attribs.height = dimensions.height;
                return enter();
            } catch (err) {
                // fallback to default values, so the HTML get validated at least
                element.attribs.width = amperize.config.img.width;
                element.attribs.height = amperize.config.img.height;
                return enter();
            }
        });
      }).on('error', function () {
        // fallback to default values, so the HTML get validated at least
        element.attribs.width = amperize.config.img.width;
        element.attribs.height = amperize.config.img.height;
        return enter();
      });
    }

    if ((element.name === 'img' || element.name === 'iframe') && !element.attribs.src) {
      return enter();
    }

    if (element.name === 'img' && amperize.config.img) {
      // when we have a gif it should be <amp-anim>.
      element.name = element.attribs.src.match(/(\.gif$)/) ? 'amp-anim' : 'amp-img';

      if (!element.attribs.width || !element.attribs.height || !element.attribs.layout) {
        element.attribs.layout = !element.attribs.layout ? amperize.config.iframe.layout : element.attribs.layout;
        if (element.attribs.src.indexOf('http') === 0) {
            return getImageSize(element);
        } else {
            element.attribs.width = amperize.config.img.width;
            element.attribs.height = amperize.config.img.height;
        }
      }
    }

    if (element.name ==='iframe') {
      element.name = 'amp-iframe';

      if (!element.attribs.width || !element.attribs.height || !element.attribs.layout) {

        element.attribs.layout = !element.attribs.layout ? amperize.config.iframe.layout : element.attribs.layout;
        element.attribs.width = !element.attribs.width ? amperize.config.iframe.width : element.attribs.width;
        element.attribs.height = !element.attribs.height ? amperize.config.iframe.height : element.attribs.height;
        element.attribs.sandbox = !element.attribs.sandbox ? amperize.config.iframe.sandbox : element.attribs.sandbox;
      }
    }

    if (element.name === 'audio') {
        element.name = 'amp-audio';
    }

    if (element.attribs && element.attribs.src) {
        // Every src attribute must be with 'https' protocol otherwise it will not get validated by AMP.
        // If we're unable to replace it, we will deal with the valitation error, but at least
        // we tried.
        if (element.attribs.src.indexOf('https://') === -1) {
            if (element.attribs.src.indexOf('http://') === 0) {
                // Replace 'http' with 'https', so the validation passes
                element.attribs.src = element.attribs.src.replace(/^http:\/\//i, 'https://');
            } else if (element.attribs.src.indexOf('//') === 0) {
                // Giphy embedded iFrames are without protocol and start with '//', so at least
                // we can fix those cases.
                element.attribs.src = 'https:' + element.attribs.src;
            }
        }
    }

    return enter();
  }, done);
};

module.exports = Amperize;
