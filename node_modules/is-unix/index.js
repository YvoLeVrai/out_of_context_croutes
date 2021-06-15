'use strict'

function isUnix (platform) {
  platform = (platform || '').toLowerCase()
  return ['linux', 'darwin', 'freebsd', 'sunos'].indexOf(platform) !== -1
}

module.exports = isUnix
