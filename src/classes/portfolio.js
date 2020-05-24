import {
  UUID,
  formatNumber,
  getPercentageChange
} from '../helpers'

import moment from 'moment-shortformat'
import { Base64 } from 'js-base64'
import Item from '../classes/item'

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

    this.migrate()
  }

  migrate () {
    this.history = this.history.map(record => {
      let firstItem = record.items[0]

      if (typeof firstItem === 'object' && !Array.isArray(firstItem)) {
        record.items = record.items.map((v, index) => {
          v.item = Item.toItem(v.item)
          return this.convertReportItemObjectToArray(v)
        })
      }

      if (!record.hash) {
        record.hash = encode({
          total: record.total,
          items: record.items.map(v => [ v[1], v[5] ])
        })
      }

      return record
    })
  }

  // remove old tab item hashes
  cleanup () {
    let { tabs, tabItems } = this
    Object.keys(tabItems).forEach(id => {
      let tab = tabs.find(tab => tab.value === id)
      if (!tab) delete tabItems[id]
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

    this.lastChecked = Date.now()
    this.isUpdating = this.shouldUpdateTabItems(tab.value, tabItemsHash)
    if (this.isUpdating) {
      this.tabItems[tab.value] = tabItemsHash
      return this.onUpdate()
    }

    return false
  }

  onUpdate () {
    // Cleanup tab item hashes before updating
    this.cleanup()

    // Update portfolio items
    let {tabItems, history, league} = this
    let previous = this.latestReport()
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


        let clusterItemIndex = cluster.findIndex(
          v => {
            let isMatch = v[1] === item.fullName &&
              v[2] === item.variant &&
              v[6] === item.links &&
              v[10] === item.isRelic

            if (
              item.source.descrText &&
              item.source.descrText.indexOf("Gem") !== -1
            ) {
              isMatch = isMatch && v[7] === itemPrice.gemQuality &&
                v[8] === itemPrice.gemLevel
            } else if (
              item.source.typeLine &&
              item.source.typeLine.indexOf("Map") !== -1
            ) {
              isMatch = isMatch && v[9] === itemPrice.mapTier
            }

            return isMatch
          }
        )

        if (clusterItemIndex < 0) {
          return cluster.push(this.buildReportItem(item, itemPrice))
        }

        let clusterItem = cluster[clusterItemIndex]
        clusterItem[3] += item.stackSize
        clusterItem[5] += item.stackSize * itemPrice.chaosValue
        clusterItem[clusterItem.length - 1].push([
          [item.stackSize, [item.source.inventoryId, item.source.w, item.source.x, item.source.y]]
        ])
      })
    })

    let report = {
      createdAt: Date.now(),
      total: cluster.reduce((p, c) => p + c[5], 0),
      items: cluster.sort((a, b) =>  b[5] - a[5])
    }

    report.hash = encode({
      total: report.total,
      items: report.items.map(v => [ v[1], v[5] ])
    })

    let pushReport = true

    if (previous && previous.hash === report.hash) {
      pushReport = false
    }

    if (pushReport) {
      this.history.push(report)
    }

    if (previous) {
      while (this.history.length > 24) {
        this.history.shift()
      }
    }

    this.isUpdating = false

    return pushReport
  }

  buildReportItem (item, itemPrice) {
    return [
      itemPrice.icon || item.icon,
      item.fullName,
      item.variant,
      item.stackSize,
      itemPrice.chaosValue,
      item.stackSize * itemPrice.chaosValue,
      item.links,
      itemPrice.gemQuality,
      itemPrice.gemLevel,
      itemPrice.mapTier,
      item.isRelic || false,
      [ this.buildReportItemChild(item) ]
    ]
  }

  buildReportItemChild (item) {
    return [item.stackSize, [item.source.inventoryId, item.source.w, item.source.x, item.source.y]]
  }

  convertReportItemObjectToArray (v) {
    let reportItem = this.buildReportItem(v.item, v.price)

    reportItem[3] = v.stackSize
    reportItem[5] = v.chaosValue

    let children = reportItem[reportItem.length - 1]
    v.children.forEach(cv => children.push(this.buildReportItemChild(cv)))

    return reportItem
  }

  latestReport () {
    return this.history.length ? this.history[this.history.length - 1] : null
  }

  lastUpdatedAt () {
    let report = this.latestReport()
    return report ? report.createdAt : null
  }

  getLastUpdateTime () {
    if (this.isUpdating) {
      return 'updating...'
    }

    let lastUpdatedAt = this.lastUpdatedAt()

    return lastUpdatedAt
      ? moment(lastUpdatedAt).short()
      : 'waiting for data...'
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

    if (priceItem.mapTier) {
      return parseInt(item.property("Map Tier").values[0][0]) === priceItem.mapTier;
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
      if (item.corrupted && !priceItem.corrupted) {
        return false
      }

      let levelTolerance = Math.max(0, Math.ceil(5 - Math.max(item.level, priceItem.gemLevel) * 0.25))
      let qualityTolerance = 0

      // 17 % and lower can be considered quality 0%
      if (priceItem.gemQuality === 0) {
        qualityTolerance = 17
      }

      // Two % below can be considered quality 20%
      if (priceItem.gemQuality === 20) {
        qualityTolerance = 2
      }

      // Handle Special Gems
      let isSpecialSupport = item.fullName.indexOf('Enhance') > -1
        || item.fullName.indexOf('Empower') > -1
        || item.fullName.indexOf('Enlighten') > -1

      if (isSpecialSupport) {
        levelTolerance = 0
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