import {
  UUID,
  clone,
  formatNumber,
  getPercentageChange
} from '../helpers'

import Item from '../classes/item'
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
    this.tabItems = {}
    this.line = {}
    this.listeners = []
    this.createdAt = createdAt || Date.now()
    this.isUpdating = false
    this.isOld = false
  }

  update (tab, tabItems) {
    this.isUpdating = true

    let existingTabItems = this.tabItems[tab.value]
    if (existingTabItems && JSON.stringify(existingTabItems) === JSON.stringify(tabItems)) {
      this.isUpdating = false
      return false
    }

    this.tabItems[tab.value] = tabItems
    this.onUpdate()

    this.isUpdating = false
    return true
  }

  onUpdate () {
    let {tabItems, history, league} = this
    let tabs = Object.keys(tabItems)
    let cluster = []
    let prices = CC.Prices[league]

    tabs.forEach(tabId => {
      let items = tabItems[tabId]

      items.forEach(item => {
        let price = prices.find(v => {
          let match = v.fullName === item.fullName
          if (match) {
            if (v.links) {
              return v.links === item.links
            } else if (v.quality && v.level) {
              return v.quality === item.quality && v.level === item.level
            } else if (v.quality) {
              return v.quality === item.quality
            } else if (v.level) {
              return v.level === item.level
            } else if (v.variant) {
              return v.variant === item.variant
            }

            return true
          }

          return false
        })

        if (price == undefined) {
          return
        }

        let clusterItem = cluster.find(entry => {
          return entry.item.fullName === item.fullName
        })

        if (!clusterItem || clusterItem.stackSize != null) {
          clusterItem = {}
          clusterItem.item = item
          clusterItem.price = price
          clusterItem.stackSize = item.stackSize
          clusterItem.chaosValue = item.stackSize * price.chaosValue
          clusterItem.children = []
          return cluster.push(clusterItem)
        }

        if (clusterItem) {
          clusterItem.stackSize += item.stackSize
          clusterItem.chaosValue += item.stackSize * price.chaosValue
          clusterItem.children.push(item)
        }
      })
    })

    let report = {
      total: cluster.reduce((p, c) => p + c.chaosValue, 0),
      createdAt: Date.now(),
      items: cluster.sort((a, b) => {
        return b.chaosValue - a.chaosValue
      })
    }

    this.history.push(report)
  }

  latestReport () {
    return this.history.length ? this.history[this.history.length - 1] : null
  }

  lastUpdatedAt () {
    let report = this.latestReport()
    return report ? report.createdAt : null
  }

  getLastUpdateTime () {
    let lastUpdatedAt = this.lastUpdatedAt()
    return lastUpdatedAt ? Ago(lastUpdatedAt) : 'syncing'
  }

  getCurrencyRate (currency) {
    currency = currency || 'Chaos Orb'

    let prices = CC.Prices[this.league]
    if (prices) {
      let price = prices.find(v => v.fullName === currency)
      return price ? price.chaosValue : 1
    }

    return 1
  }

  getCurrencyShorthand (currency) {
    return Portfolio.Shorthands[currency || 'Chaos Orb'] || 'C'
  }

  getHoldings (currency) {
    let report = this.latestReport()
    let rate = this.getCurrencyRate(currency)
    let shorthand = this.getCurrencyShorthand(currency)
    let total = (report ? report.total : 0) / rate

    return {
      value: total,
      valueFormatted: formatNumber(total),
      currency: shorthand
    }
  }

  getChange (currency) {
    let { history } = this
    let previousHoldings = history.length > 1 ? this.history[this.history.length - 2].total : 0
    let currentHoldings = history.length > 0 ? this.history[this.history.length - 1].total : 0
    let percentageChange = getPercentageChange(previousHoldings, currentHoldings)
    let rate = this.getCurrencyRate(currency)
    let shorthand = this.getCurrencyShorthand(currency)

    return {
      direction: percentageChange.direction,
      directionIndicator: percentageChange.direction === 'up' ? '+' : '-',
      directionClassName: percentageChange.direction ? percentageChange.direction : '',
      value: Math.abs(previousHoldings - currentHoldings),
      valueFormatted: formatNumber(Math.abs(previousHoldings - currentHoldings)),
      percentage: percentageChange,
      currency: shorthand
    }
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

Portfolio.Shorthands = {
  'Chaos Orb': 'C',
  'Exalted Orb': 'Ex',
  'Jeweller\'s Orb': 'Jew',
  'Gemcutter\'s Prism': 'GCP',
  'Eternal Orb': 'Et',
  'Alchemy Orb': 'Alch',
  'Orb of Alteration': 'Alt',
  'Orb of Fusing': 'Fus',
  'Chromatic Orb': 'Chrome',
  'Augmentation Orb': 'Aug',
  'Vaal Orb': 'Vaal',
  'Cartographer\'s Chisel': 'Chis',
  'Orb of Scouring': 'Scour',
  'Transmuation Orb': 'Trans'
}

module.exports = Portfolio