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
          },
          iframe: {
            layout: 'responsive',
            width: 600,
            height: 400
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
    this.timeout(15000);
    it('throws an error if no callback provided', function () {
      function err() {
        amperize.parse('', null);
      }

      expect(err).throws('No callback provided');
    });

    it('transforms <img> with layout property into <amp-img></amp-img> without overriding it and full image dimensions', function (done) {
      amperize.parse('<img src="http://static.wixstatic.com/media/355241_d31358572a2542c5a44738ddcb59e7ea.jpg_256" layout="FIXED">', function (error, result) {
        expect(result).to.contain('<amp-img');
        expect(result).to.contain('src="http://static.wixstatic.com/media/355241_d31358572a2542c5a44738ddcb59e7ea.jpg_256"');
        expect(result).to.contain('layout="FIXED"');
        expect(result).to.contain('width="256"');
        expect(result).to.contain('height="256"');
        expect(result).to.contain('</amp-img>');
        done();
      });
    });

    it('transforms .gif <img> with only height property into <amp-anim></amp-anim> with full dimensions by overriding them', function (done) {
      amperize.parse('<img src="https://media.giphy.com/media/l46CtzgjhTm29Cbjq/giphy.gif" height="500">', function (error, result) {
        expect(result).to.contain('<amp-anim');
        expect(result).to.contain('src="https://media.giphy.com/media/l46CtzgjhTm29Cbjq/giphy.gif"');
        expect(result).to.contain('layout="responsive"');
        expect(result).to.contain('width="800"');
        expect(result).to.contain('height="600"');
        expect(result).to.contain('</amp-anim>');
        done();
      });
    });

    it('transforms <iframe> with only width property into <amp-iframe></amp-iframe> with full dimensions withour overriding them', function (done) {
      amperize.parse('<iframe src="https://www.youtube.com/embed/HMQkV5cTuoY" width="400"></iframe>', function (error, result) {
        expect(result).to.contain('<amp-iframe');
        expect(result).to.contain('src="https://www.youtube.com/embed/HMQkV5cTuoY"');
        expect(result).to.contain('layout="responsive"');
        expect(result).to.contain('width="400"');
        expect(result).to.contain('height="400"');
        expect(result).to.contain('</amp-iframe>');
        done();
      });
    });

    it('transforms local <img> into <amp-img></amp-img> without image dimensions', function (done) {
      amperize.parse('<img src="/content/images/IMG_xyz.jpg">', function (error, result) {
        expect(result).to.contain('<amp-img');
        expect(result).to.contain('src="/content/images/IMG_xyz.jpg"');
        expect(result).to.contain('layout="responsive"');
        expect(result).to.not.contain('width');
        expect(result).to.not.contain('height');
        expect(result).to.contain('</amp-img>');
        done();
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
