'use strict'

/* should, describe, it, should */

var isUNIX = require('..')
require('should')

describe('is-unix', function () {
  it('empty input', function () {
    isUNIX().should.be.false()
  })

  it('windows is not UNIX', function () {
    isUNIX('win32').should.be.false()
  })

  it('linux, darwin, freebsd and sunos are UNIX', function () {
    ['linux', 'darwin', 'freebsd', 'sunos'].forEach(function (platform) {
      isUNIX(platform).should.be.true()
    })
  })
})
