export function UUID() {
  return Math.random().toString(36).substring(2) + (new Date()).getTime().toString(36)
}

export function formatNumber(n, decimals = 2, sectionDelimiter = ",", decimalDelimiter = ".") {
  return n.toFixed(decimals).replace(/./g, function (c, i, a) {
    return i && c !== decimalDelimiter && ((a.length - i) % 3 === 0) ? sectionDelimiter + c : c;
  })
}

export function padNumber(i) {
  return (i < 10) ? `0${i}` : `${i}`
}

export function promiseDelay(time) {
  return new Promise(function (fulfill) {
    setTimeout(fulfill, time);
  });
}

export function getNinjaDate() {
  let date = new Date()
  return [
    padNumber(date.getFullYear()),
    padNumber(date.getMonth()),
    padNumber(date.getDay())
  ].join('-')
}

export function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

export function getPercentageChange(a, b) {
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
export function GoToUrl(url, event) {
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

export const p = {
  tap: fn => d => {
    fn(d)
    return d
  },

  merge: (promise, ot = (d => d), it = (d => d)) => d =>
    promise(it(d))
      .then(ot)
      .then(r => Object.assign({}, d, r)),

  state: (context, fn) => p.tap(d => context.setState(fn(d)))
}