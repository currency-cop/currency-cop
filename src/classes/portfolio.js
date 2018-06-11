import {
  UUID,
  encode,
  decode,
  formatNumber,
  getPercentageChange
} from '@/helpers'

import Item from '@/classes/item'
import Ago from '@/classes/ago'

// use window require to avoid fs issues
const alasql = window.require('alasql')
const ts = window.require('timeseries-bins')

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

  getItemPrice (item, priceItem) {
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

    // Price check fallthroughs
    if (priceItem.links) {
      return priceItem.links === item.links
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

    return true
  }

  getPriceMatrix (league, chaosValue) {
    let currencies = Object.keys(Portfolio.Shorthands)
    let prices = CC.Prices[league]
    let matrix = {}

    prices.forEach(priceItem => {
      // Ignore non-currency items by frameType
      if (priceItem.type !== 'currency') {
        return
      }

      // Skip non-supported currency items
      if (currencies.indexOf(priceItem.fullName) < 0) {
        return
      }

      let shorthand = Portfolio.Shorthands[priceItem.fullName]
      matrix[shorthand] = chaosValue / priceItem.chaosValue
    })

    return matrix
  }

  getStackPriceMatrix (league, chaosValue, stackSize) {
    let matrix = this.getPriceMatrix(league, chaosValue)

    Object.keys(matrix).forEach(currency => {
      matrix[currency] = matrix[currency] * stackSize
    })

    return matrix
  }


  onUpdate () {
    let {tabItems, history, league} = this
    let prices = CC.Prices[league]
    let cluster = []

    let tabReports = {}

    Object.keys(tabItems).forEach(tabId => {
      let items = decode(tabItems[tabId])
      let tabReport = {
        id: tabId,
        value: {},
        items: []
      }

      items.forEach(item => {
        item = Item.toItem(item)

        let itemPrice = prices.find(pi => this.getItemPrice(item, pi))
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
          clusterItem.valueMatrix = this.getPriceMatrix(league, clusterItem.chaosValue)
          clusterItem.children = []

          return cluster.push(clusterItem)
        }

        if (clusterItem) {
          clusterItem.stackSize += item.stackSize
          clusterItem.chaosValue += item.stackSize * itemPrice.chaosValue
          clusterItem.valueMatrix = this.getPriceMatrix(league, clusterItem.chaosValue)
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

    while (this.history.length > 720) {
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

export default Portfolio