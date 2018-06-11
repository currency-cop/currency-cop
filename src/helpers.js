export function promiseDelay (time) {
  return new Promise(function (fulfill) {
    setTimeout(fulfill, time);
  });
}

export function UUID () {
  return Math.random().toString(36).substring(2) + (new Date()).getTime().toString(36)
}

export function formatNumber (n, decimals = 2, sectionDelimiter = ",", decimalDelimiter = ".") {
  return n.toFixed(decimals).replace(/./g, function (c, i, a) {
    return i && c !== decimalDelimiter && ((a.length - i) % 3 === 0) ? sectionDelimiter + c : c;
  })
}

export function padNumber (i) {
  return (i < 10) ? `0${i}` : `${i}`
}

export function getPercentageChange (a, b) {
  let change = parseFloat((((b - a) / a) * 100).toFixed(2))
  let absChange = Math.abs(change)
  let direction = change < 0
    ? 'down'
    : change > 0
    ? 'up'
    : null

  return {
    change,
    absChange,
    direction
  }
}

/* API Helpers */

export function getNinjaDate () {
  let date = new Date()
  return [
    padNumber(date.getFullYear()),
    padNumber(date.getMonth()),
    padNumber(date.getDay())
  ].join('-')
}

/* Electron Helpers */

const electron = window.require('electron')
const shell  = electron.shell
export function GoToUrl (url, event) {
  if (url && url.preventDefault && !url.target.href) {
    event = url
    event.preventDefault()
    shell.openExternal(event.target.parentNode.href)
  } else if (url && url.preventDefault) {
    event = url
    event.preventDefault()
    shell.openExternal(event.target.href)
  } else {
    event.preventDefault()
    shell.openExternal(url)
  }
}

/* Base 64 Helpers */

import { Base64 } from 'js-base64'

export function encode (obj) {
  return Base64.encode(JSON.stringify(obj))
}

export function decode (str) {
  return JSON.parse(Base64.decode(str))
}

/* JSON Helpers */

export function clone (obj) {
  return JSON.parse(JSON.stringify(obj))
}