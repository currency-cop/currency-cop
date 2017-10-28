exports.UUID = () => {
  return Math.random().toString(36).substring(2) + (new Date()).getTime().toString(36)
}

exports.padNumber = (i) => {
  return (i < 10) ? `0${i}` : `${i}`
}

exports.promiseDelay = (time) => {
  return new Promise(function (fulfill) {
    setTimeout(fulfill, time);
  });
}

exports.getNinjaDate = () => {
  let date = new Date()
  return [
    exports.padNumber(date.getFullYear()),
    exports.padNumber(date.getMonth()),
    exports.padNumber(date.getDay())
  ].join('-')
}

exports.clone = (obj) => {
  return JSON.parse(JSON.stringify(obj))
}

exports.getPercentageChange = (a, b) => {
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

import { shell } from 'electron'
exports.GoToUrl = (url, event) => {
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