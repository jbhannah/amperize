'use strict';

var EventEmitter = require('events').EventEmitter,
    emits = require('emits'),
    html = require('htmlparser2'),
    util = require('util'),
    uuid = require('uuid'),
    async = require('async'),
    url = require('url'),
    got = require('got'),
    _ = require('lodash'),
    sizeOf = require('image-size'),
    validator = require('validator'),
    helpers = require('./helpers'),
    DEFAULTS = {
        'amp-img': {
            layout: 'responsive',
            width: 600,
            height: 400
        },
        'amp-anim': {
            layout: 'responsive',
            width: 600,
            height: 400
        },
        'amp-iframe': {
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
    this.config = _.merge({}, DEFAULTS, options || {});
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
    var id;

    if (typeof callback !== 'function') {
        throw new Error('No callback provided');
    }

    id = uuid.v4();

    this.once('read', this.amperizer.bind(this, id));
    this.once('parsed: ' + id, callback);

    this.htmlParser.parseComplete(content);
};

/**
* Turn a traversible DOM into string content. Borrowed from Minimize.
*
* https://github.com/Swaagie/minimize/blob/4b815e274a424ca89551d28c4e0dd8b06d9bbdc2/lib/minimize.js#L74
*
* @param {String} id
* @param {Object} error
* @param {Object} dom Traversible DOM object
* @api private
*/
Amperize.prototype.amperizer = function amperizer(id, error, dom) {
    if (error) {
        throw new Error('Amperizer failed to parse DOM', error);
    }

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
    var self = this;

    async.reduce(data, html, function reduce(html, element, step) {
        var children;

        function close(error, html) {
            html += helpers.close(element);
            step(null, html);
        }

        function enter() {
            children = element.children;
            html += helpers[element.type](element);

            if (!children || !children.length) {
                return close(null, html);
            }

            setImmediate(function delay() {
                traverse.call(self, children, html, close);
            });
        }

        function useSecureSchema(element) {
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
        }

        function getLayoutAttribute(element) {
            var layout;

            // check if element.width is smaller than 300 px. In that case, we shouldn't use
            // layout="responsive", because the media element will be stretched and it doesn't
            // look nice. Use layout="fixed" instead to fix that.
            layout = element.attribs.width < 300 ? layout = 'fixed' : self.config[element.name].layout;

            element.attribs.layout = !element.attribs.layout ? layout : element.attribs.layout;

            return enter();
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
            var imageObj = url.parse(element.attribs.src),
                requestOptions,
                timeout = 3000;

            if (!validator.isURL(imageObj.href)) {
                // revert this element, do not show
                element.name = 'img';

                return enter();
            }

            // We need the user-agent, otherwise some https request may fail (e. g. cloudfare)
            requestOptions = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 Safari/537.36'
                },
                timeout: timeout,
                encoding: null
            };

            return got(
                imageObj.href,
                requestOptions
            ).then(function (response) {
                try {
                    // Using the Buffer rather than an URL requires to use sizeOf synchronously.
                    // See https://github.com/image-size/image-size#asynchronous
                    var dimensions = sizeOf(response.body);

                    // CASE: `.ico` files might have multiple images and therefore multiple sizes.
                    // We return the largest size found (image-size default is the first size found)
                    if (dimensions.images) {
                        dimensions.width = _.maxBy(dimensions.images, function (w) {return w.width;}).width;
                        dimensions.height = _.maxBy(dimensions.images, function (h) {return h.height;}).height;
                    }

                    element.attribs.width = dimensions.width;
                    element.attribs.height = dimensions.height;

                    return getLayoutAttribute(element);
                } catch (err) {
                    // revert this element, do not show
                    element.name = 'img';
                    return enter();
                }
            }).catch(function () {
                // revert this element, do not show
                element.name = 'img';
                return enter();
            });
        }

        if ((element.name === 'img' || element.name === 'iframe') && !element.attribs.src) {
            return enter();
        }

        if (element.name === 'img' && self.config['amp-img']) {
            // when we have a gif it should be <amp-anim>.
            element.name = element.attribs.src.match(/(\.gif$)/) ? 'amp-anim' : 'amp-img';

            if (!element.attribs.width || !element.attribs.height || !element.attribs.layout) {
                if (element.attribs.src.indexOf('http') === 0) {
                    return getImageSize(element);
                }
            }
            // Fallback to default values for a local image
            element.attribs.width = self.config['amp-img'].width;
            element.attribs.height = self.config['amp-img'].height;
            return getLayoutAttribute(element);
        }

        if (element.name === 'iframe') {
            element.name = 'amp-iframe';

            if (!element.attribs.width || !element.attribs.height || !element.attribs.layout) {
                element.attribs.width = !element.attribs.width ? self.config['amp-iframe'].width : element.attribs.width;
                element.attribs.height = !element.attribs.height ? self.config['amp-iframe'].height : element.attribs.height;
                element.attribs.sandbox = !element.attribs.sandbox ? self.config['amp-iframe'].sandbox : element.attribs.sandbox;

                useSecureSchema(element);

                return getLayoutAttribute(element);
            }
        }

        if (element.name === 'audio') {
            element.name = 'amp-audio';
        }

        useSecureSchema(element);

        return enter();
    }, done);
};

module.exports = Amperize;
