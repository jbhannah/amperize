'use strict';

var chai = require('chai')
  , expect = chai.expect
  , sinon = require('sinon')
  , sinonChai = require('sinon-chai')
  , Amperize = require('../lib/amperize')
  , amperize;

chai.use(sinonChai);
chai.config.includeStack = true;

describe('Amperize', function () {
  beforeEach(function () {
    amperize = new Amperize();
  });

  afterEach(function () {
    amperize = void 0;
  });

  describe('is a module', function () {
    it('which has a constructor', function () {
      expect(Amperize).to.be.a('function');
    });

    it('which has default options', function () {
      expect(amperize).to.have.property('config');
      expect(amperize.config).to.be.eql({
        img: {
          layout: 'responsive'
        }
      });
    });

    it('which can be configured', function () {
      var configurable = new Amperize({some: 'options'});
      expect(configurable).to.have.property('config');
      expect(configurable.config.some).to.be.equal('options');
    });

    it('which has htmlParser', function () {
      expect(amperize).to.have.property('htmlParser');
      expect(amperize.htmlParser).to.be.a('object');
    });

    it('which has #parse', function () {
      expect(amperize).to.have.property('parse');
      expect(amperize.parse).to.be.a('function');
    });

    it('which has #amperizer', function () {
      expect(amperize).to.have.property('amperizer');
      expect(amperize.amperizer).to.be.a('function');
    });
  });

  describe('#parse', function () {
    it('throws an error if no callback provided', function () {
      function err() {
        amperize.parse('', null);
      }

      expect(err).throws('No callback provided');
    });

    it('transforms <img> into <amp-img></amp-img>', function () {
      amperize.parse('<img src="http://lorempixel.com/output/abstract-q-c-640-480-3.jpg">', function (error, result) {
        expect(result).to.be.equal('<amp-img src="http://lorempixel.com/output/abstract-q-c-640-480-3.jpg" layout="responsive" width="640" height="480"></amp-img>');
      });
    });
  });

  describe('#amperizer', function () {
    it('throws an error if HTML parsing failed', function () {
      function err() {
        amperize.amperizer('some error', []);
      }

      expect(err).throws('Amperizer failed to parse DOM');
    });

    it('should start traversing the DOM as soon as HTML parser is ready', function (done) {
      var emit = sinon.spy(amperize, 'emit');

      amperize.parse('<html><body></body></html>', function () {
        expect(emit).to.be.calledTwice;

        var first = emit.getCall(0).args;
        expect(first).to.be.an('array');
        expect(first[0]).to.be.equal('read');
        expect(first[1]).to.be.equal(null);
        expect(first[2]).to.be.an('array');

        var second = emit.getCall(1).args;
        expect(second).to.be.an('array');
        expect(second[0]).to.be.include('parsed');
        expect(second[1]).to.be.equal(null);
        expect(second[2]).to.be.equal('<html><body></body></html>');

        done();
      });
    });
  });
});
