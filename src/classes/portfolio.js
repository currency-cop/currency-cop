import {
  UUID,
  formatNumber,
  getPercentageChange
} from '../helpers'

import { Base64 } from 'js-base64'
import Item from '../classes/item'
import Ago from '../classes/ago'

const HOUR = 1000 * 60 * 60

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

  shouldUpdateTabItems (tabId, hash) {
    let itemHash = this.tabItems[tabId]
    if (itemHash == null) {
      return true
    }

    if (itemHash === hash) {
      let lastUpdated = this.lastUpdatedAt()
      if (lastUpdated == null) {
        return true
      }

      if (lastUpdated && (Date.now() - lastUpdated) < HOUR) {
        return false
      }
    }

    return true
  }

  // ran only when a tab is updated
  update (tab, tabItems) {
    let tabItemsHash = encode(tabItems)
    this.isUpdating = this.shouldUpdateTabItems(tab.value, tabItemsHash)
    if (this.isUpdating) {
      this.tabItems[tab.value] = tabItemsHash
      this.onUpdate()
      return true
    }

    return false
  }

  // remove old tab item hashes
  cleanup () {
    let { tabs, tabItems } = this
    Object.keys(tabItems).forEach(id => {
      if (!tabs.find(tab => tab.value === id)) {
        delete tabItems[id]
      }
    })
  }

  onUpdate () {
    // Cleanup tab item hashes before updating
    this.cleanup()

    // Update portfolio items
    let {tabItems, history, league} = this
    let prices = CC.Prices[league]
    let cluster = []

    Object.keys(tabItems).forEach(tabId => {
      let items = decode(tabItems[tabId])

      items.forEach(item => {
        item = Item.toItem(item)

        let itemPrice = prices.find(pi => this.isItemPriceObject(item, pi))
        if (!itemPrice) {
          return
        }

        let clusterItem = cluster.find(entry => {
          return entry.item.fullName === item.fullName
        })

        if (!clusterItem || clusterItem.stackSize == null) {
          clusterItem = {}
          clusterItem.item = item
          clusterItem.price = itemPrice
          clusterItem.stackSize = item.stackSize
          clusterItem.chaosValue = item.stackSize * itemPrice.chaosValue
          clusterItem.children = []

          return cluster.push(clusterItem)
        }

        if (clusterItem) {
          clusterItem.stackSize += item.stackSize
          clusterItem.chaosValue += item.stackSize * itemPrice.chaosValue
          clusterItem.children.push(item)
        }
      })
    })

    let report = {
      createdAt: Date.now(),
      total: cluster.reduce((p, c) => p + c.chaosValue, 0),
      items: cluster.sort((a, b) => {
        return b.chaosValue - a.chaosValue
      })
    }

    this.history.push(report)

    while (this.history.length > 24) {
      this.history.shift()
    }

    this.isUpdating = false
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


  isItemPriceObject (item, priceItem) {
    if (priceItem.fullName !== item.fullName) {
      return false
    }

    // Low Confidence Filter
    if ('count' in priceItem && priceItem.count < 1) {
      return false
    }

    // higher order relic check
    if (Item.isRelic(priceItem) && !item.isRelic) {
      return false
    }

    if (priceItem.gemQuality || priceItem.gemLevel) {
      // Todo: move gem logic to item processing
      let levelTolerance = Math.max(0, Math.ceil(5 - Math.max(item.level, priceItem.gemLevel) * 0.25))
      let qualityTolerance = Math.max(0, Math.ceil(4 - Math.max(item.quality, priceItem.gemQuality) * 0.2))
      let isSpecialSupport = item.fullName.indexOf('Enhance Support') > -1 
        || item.fullName.indexOf('Empower Support') > -1 
        || item.fullName.indexOf('Enlighten Support') > -1

      if (isSpecialSupport) {
        levelTolerance = 0;
      }

      let levelsClose = Math.abs(priceItem.gemLevel - item.level) <= levelTolerance
      let qualityClose = Math.abs(priceItem.gemQuality - item.quality) <= qualityTolerance
      return levelsClose && qualityClose
    }

    if (priceItem.quality && priceItem.level) {
      return priceItem.quality === item.quality 
          && priceItem.level === item.level
    }

    if (priceItem.quality) {
      return priceItem.quality === item.quality
    }

    if (priceItem.level) {
      return priceItem.level === item.level
    }

    if (priceItem.variant && item.variant) { 
      // to simplify the logic, we sometimes set a variant event if poe.ninja doesn't
      return priceItem.variant === item.variant
    }

    // Price check fallthroughs
    if (priceItem.links != null) {
      return priceItem.links === item.links
    }

    return true
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

export default Portfolio