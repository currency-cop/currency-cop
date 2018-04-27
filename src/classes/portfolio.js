import {
  UUID,
  clone,
  formatNumber,
  getPercentageChange
} from '../helpers'

import { Base64 } from 'js-base64'
import Item from '../classes/item'
import Ago from '../classes/ago'

function encode (obj) {
  return Base64.encode(JSON.stringify(obj))
}

function decode (str) {
  return JSON.parse(Base64.decode(str))
}

class Portfolio {
  constructor ({
    id,
    name,
    league,
    history,
    tabs,
    tabItems,
    createdAt
  }) {
    this.id = id || UUID()
    this.name = name
    this.tabs = tabs || []
    this.league = league
    this.history = history || []
    this.tabItems = tabItems || {}
    this.line = {}
    this.listeners = []
    this.createdAt = createdAt || Date.now()
    this.isUpdating = false
    this.isOld = false

    // Convert history elements to classes
    this.history.forEach(record => {
      record.items.forEach(entry => {
        entry.item = Item.toItem(entry.item)
      })
    })
  }

  update (tab, tabItems) {
    this.isUpdating = true

    const HOUR = 1000 * 60 * 60
    let tabItemsHash = this.tabItems[tab.value]
    let currentTabItemsHash = encode(tabItems)
    if (tabItemsHash && tabItemsHash === currentTabItemsHash) {
      let lastUpdated = this.lastUpdatedAt()
      if (!lastUpdated) {
        this.isUpdating = false
        return false
      }

      if (lastUpdated && (Date.now() - lastUpdated) < HOUR) {
        this.isUpdating = false
        return false
      }
    }

    this.tabItems[tab.value] = encode(tabItems)
    this.onUpdate()

    this.isUpdating = false
    return true
  }

  onUpdate () {
    let {tabItems, history, league} = this
    let tabs = Object.keys(tabItems)
    let prices = CC.Prices[league]
    let cluster = []

    tabs.forEach(tabId => {
      let items = decode(tabItems[tabId])

      items.forEach(item => {
        item = Item.toItem(item)
  
        let price = prices.find(v => {
          if (v.fullName === item.fullName) {
            // Low Confidence Filter
            if ('count' in v && v.count < 1) {
              return false
            }

            // Relic check
            if (v.icon.indexOf('relic=1') > -1 && item.icon.indexOf('relic=1') < 0) {
              return false
            }

            // Price check fallthroughs
            if (v.links) {
              return v.links === item.links
            } else if (v.gemQuality || v.gemLevel) {
              let levelTolerance = Math.max(0, Math.ceil(5 - Math.max(item.level, v.gemLevel)*0.25));
              let qualityTolerance = Math.max(0, Math.ceil(4 - Math.max(item.quality, v.gemQuality) * 0.2));

              if (item.fullName.indexOf('Enhance Support') !== -1 || item.fullName.indexOf('Empower Support') !== -1 || item.fullName.indexOf('Enlighten Support') !== -1) {
                levelTolerance = 0;
              }

              let levelsClose = Math.abs(v.gemLevel - item.level) <= levelTolerance;
              let qualityClose = Math.abs(v.gemQuality - item.quality) <= qualityTolerance;

              return levelsClose && qualityClose;
            } else if (v.quality && v.level) {
              return v.quality === item.quality && v.level === item.level
            } else if (v.quality) {
              return v.quality === item.quality
            } else if (v.level) {
              return v.level === item.level
            } else if (v.variant && item.variant) { // to simplify the logic, we sometimes set a variant event if poe.ninja doesn't
              return v.variant === item.variant
            } else {
              return true
            }
          }

          return false
        })

        if (price == undefined) {
          return
        }

        let clusterItem = cluster.find(entry => {
          return entry.item.fullName === item.fullName
        })

        if (!clusterItem || clusterItem.stackSize == null) {
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

    while (this.history.length > 24) {
      this.history.shift()
    }
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
      directionIndicator: !percentageChange.direction ? '' : percentageChange.direction === 'up' ? '+' : '-',
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
      tabs: this.tabs,
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