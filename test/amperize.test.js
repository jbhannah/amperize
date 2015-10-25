'use strict';

var chai = require('chai')
  , expect = chai.expect
  , sinon = require('sinon')
  , sinonChai = require('sinon-chai')
  , Amperize = require ('../lib/amperize')
  , amperize

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
      expect(amperize.config).to.be.eql({});
    });

    it('which can be configured', function () {
      var configurable = new Amperize({some: 'options'});
      expect(configurable).to.have.property('config');
      expect(configurable.config.some).to.be.equal('options');
    });
  });
});
