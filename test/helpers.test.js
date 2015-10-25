'use strict';

var chai = require('chai')
  , expect = chai.expect
  , helpers = require('../lib/helpers');

describe('helpers', function () {
  describe('#tag', function () {
    it('returns an opening tag with attributes', function () {
      var el = {
        type: 'tag',
        name: 'foo',
        attribs: {
          bar: 'bat'
        }
      };

      expect(helpers.tag(el)).to.be.equal('<foo bar="bat">');
    });

    it('returns an opening tag without attributes', function () {
      var el = {
        type: 'tag',
        name: 'foo'
      };

      expect(helpers.tag(el)).to.be.equal('<foo>');
    });
  });

  describe('#close', function () {
    it('closes non-singular tags', function () {
      var el = {
        type: 'tag',
        name: 'foo'
      };

      expect(helpers.close(el)).to.be.equal('</foo>');
    });

    it('does not close singular tags', function () {
      var el = {
        type: 'tag',
        name: 'img'
      };

      expect(helpers.close(el)).to.be.equal('');
    });

    it('does not close non-tags', function () {
      var el = {
        type: 'foo',
        name: 'bar'
      };

      expect(helpers.close(el)).to.be.equal('');
    });
  });
});
