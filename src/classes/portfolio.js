import {
  UUID,
  clone,
  formatNumber,
  getPercentageChange
} from '../helpers'

import Ago from '../classes/ago'

class Portfolio {
  constructor ({
    id,
    name,
    league,
    history,
    tabs,
    createdAt
  }) {
    this.id = id || UUID()
    this.name = name
    this.tabs = tabs || []
    this.league = league
    this.history = history || []
    this.data = {}
    this.line = {}
    this.createdAt = createdAt || Date.now()
    this.isUpdating = false
  }

  update (tab, items) {
    this.isUpdating = true

    let existingItems = this.data[tab.value]
    if (existingItems && JSON.stringify(existingItems) === JSON.stringify(items)) {
      console.log('no-change, not updating')
      this.isUpdating = false
      return
    }

    this.data[tab.value] = items
    this.isUpdating = false
  }

  latestReport () {
    return this.history.length ? this.history[this.history.length - 1] : null
  }

  getHoldings (currency) {
    let report = this.latestReport()
    return {
      value: report ? report.total : 0,
      valueFormatted: formatNumber(report ? report.total : 0),
      currency: 'C' // todo...
    }
  }

  getChange (currency) {
    let { history } = this
    let previousHoldings = history.length ? this.history[this.history.length - 2].total : 0
    let currentHoldings = history.length ? this.history[this.history.length - 1].total : 0
    let percentageChange = getPercentageChange(previousHoldings, currentHoldings)

    return {
      direction: percentageChange.direction,
      directionIndicator: percentageChange.direction === 'up' ? '+' : '-',
      directionClassName: percentageChange.direction ? percentageChange.direction : '',
      value: Math.abs(previousHoldings - currentHoldings),
      valueFormatted: formatNumber(Math.abs(previousHoldings - currentHoldings)),
      percentage: percentageChange,
      currency: 'C'
    }
  }

  getLastUpdateTime () {
    let lastUpdatedAt = this.lastUpdatedAt()
    return lastUpdatedAt ? Ago(lastUpdatedAt) : 'syncing'
  }

  lastUpdatedAt () {
    let report = this.latestReport()
    return report ? report.createdAt : null
  }

  toObject () {
    return {
      id: this.id,
      name: this.name,
      league: this.league,
      history: this.history,
      createdAt: this.createdAt
    }
  }
}

module.exports = Portfolio