'use strict';

var merge = require('lodash.merge');

var DEFAULTS = {};

/**
 * Amperizer constructor.
 *
 * @constructor
 * @param {Object} options Options object
 * @api public
 */
function Amperize(options) {
  this.config = merge({}, DEFAULTS, options || {});
}

module.exports = Amperize;
