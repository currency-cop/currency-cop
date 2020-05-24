import Api from '../api'
import Item from './item'
import * as Helpers from '../helpers'
import CacheFile from './cachefile'
import * as Constants from '../constants'

class ApiClient {
  constructor (options = {}) {
    this.log = (options.logger ? options.logger : CC.Logger).topic('ApiClient')
    this.cache = new CacheFile('ApiClientCache', options.cacheFileLocation, options.logger || CC.Logger)
    this.accountName = options.accountName
    this.accountSessionId = options.accountSessionId
  }

  async authorize ({ sessionId }) {
    let sessionResponse = await Api.LoginWithCookie(sessionId)
    if (sessionResponse.status != 200) {
      this.log.warn(`[AUTHORIZE]: Expired Session ID - ${sessionResponse.status}`)
      throw ({
        code: 400,
        message: 'Session ID failed to authorize your account. Try refreshing your session id.'
      })
    }

    let accountResponse = await Api.GetAccountName(sessionId)
    if (!accountResponse || !accountResponse.data) {
      this.log.warn(`[AUTHORIZE]: Empty response from server on name check`)
      throw ({
        code: 500,
        message: `Unable to fetch profile with that Session Id. Try refreshing your session id.`
      })
    }

    let accountNameMatches = accountResponse.data.match(Constants.POE_ACCOUNT_NAME_REGEXP)
    if (!accountNameMatches[1]) {
      this.log.error(`[AUTHORIZE] Failed to identify account name: ${accountResponse.data}`)
      throw ({
        code: 404,
        message: 'Failed to identify account name in response. Please send logs or try again.'
      })
    }

    this.accountName = decodeURIComponent(accountNameMatches[1])
    this.accountSessionId = sessionId

    return this
  }

  async getLeagues () {
    let leagueCache = this.cache.get(`${this.accountName}-leagues`)
    if (leagueCache) {
      return leagueCache
    }

    let leagueResponse = await Api.GetLeagues()
    if (!leagueResponse || !leagueResponse.data) {
      throw ({
        retry: true,
        message: 'Failed to fetch league data'
      })
    }

    this.cache.set(`${this.accountName}-leagues`, leagueResponse.data, 60 * 60 * 24)
    this.cache.save()

    return leagueResponse.data
  }

  async getItemRates (type, league) {
    let isEvent = league.indexOf(' Event') > -1
    let isSSF = league.indexOf('SSF ') > -1
    let isHC = league.match(/\s?HC\s?/)

    // Patch for leagues like:
    // SSF Flashback Event (BRE003) -> 001 (Standard)
    // HC SSF Flashback Event (BRE004) -> 002 (Hardcore)
    if (isEvent && isSSF) {
      if (isHC) {
        league = league.replace(/\d{3}/, '002')
      } else {
        league = league.replace(/\d{3}/, '001')
      }
    }

    // Patch for leagues like:
    // SSF Bestiary HC -> Hardcore Bestiary
    if (!isEvent && isSSF && isHC) {
      league = league.replace(' HC', '')
      league = `Hardcore ${league}`
    }

    // Patch for leagues like:
    // SSF Bestiary -> Bestiary
    if (isSSF) {
      league = league.replace('SSF ', '')
    }

    let itemRatesCacheName = `${this.accountName}-rates-${type}-${league}`
    let list = this.cache.get(itemRatesCacheName)
    let fetched = false
    if (!list) {
      let date = Helpers.getNinjaDate()
      let response = await Api.ItemRateTypes[type](league, date)
      if (response && response.status !== 200) {
        response = await Api.ItemRateTypes[type](league, date)
      }

      // On error, detail that we can retry and the error
      if (!response || !response.data || response.status !== 200) {
        throw ({
          retry: true,
          message: `Failed to obtain ${type} item rates for ${league} league.`
        })
      }

      // Process items
      list = response.data
      fetched = true
    }

    let output = []
    if (list && list.lines && list.lines.length) {
      for (const entry of list.lines) {
        let name = entry.currencyTypeName || entry.name
        let fullName = name
        
        if (name && entry.baseType && name.indexOf(entry.baseType) < 0) {
          fullName = `${name} ${entry.baseType}`
        }

        if (!fullName) {
          name = entry.baseType
        }

        let details = {}
        if (list.currencyDetails) {
          details = list.currencyDetails.find(v => v.name === name)
        }

        let item = {
          orderId: details.poeTradeId || entry.poeTradeId || entry.id,
          type: type,
          icon: details.icon || entry.icon,
          name: name,
          nameLowercase: name.toLowerCase(),
          baseType: entry.baseType,
          baseTypeLowercase: entry.baseType ? entry.baseType.toLowerCase() : null,
          fullName: fullName,
          fullNameLowercase: fullName ? fullName.toLowerCase() : null,
          stackSize: entry.stackSize,
          chaosValue:  entry.chaosEquivalent || entry.chaosValue,
          exaltedValue: entry.exaltedValue,
          links: entry.links,
          variant: entry.variant,
          corrupted: entry.corrupted,
          count: entry.count
        }

        if (type === 'currency') {
          item.count = 1000
        }

        if (type === 'gem') {
          item.gemLevel = entry.gemLevel
          item.gemQuality = entry.gemQuality
          item.corrupted = entry.corrupted
          item.variant = entry.variant
        }

        if (type === 'map') {
          item.mapTier = entry.mapTier
        }

        output.push(item)
      }
    }

    // Add in chaos orb manually...
    if (type === 'currency') {
      output.push({
        orderId: 1,
        type: type,
        icon: 'http://web.poecdn.com/image/Art/2DItems/Currency/CurrencyRerollRare.png?scale=1&w=1&h=1',
        name: 'Chaos Orb',
        nameLowercase: 'chaos orb',
        fullName: 'Chaos Orb',
        fullNameLowercase: 'chaos orb',
        baseType: undefined,
        baseTypeLowercase: null,
        type: 'currency',
        chaosValue: 1,
        exaltedValue: output.find(v => v.name === 'Exalted Orb').chaosValue,
        stackSize: 10,
        links: undefined,
        variant: undefined,
        count: 1000
      })
    }

    if (fetched) {
      this.cache.set(itemRatesCacheName, list, 60 * 60 * 24)
      this.cache.save()
    }

    return output
  }

  _convertTabItems ({ league, tab, items }) {
    let output = []

    if (items && items.length) {
      for (let entry of items) {
        output.push(new Item({
          tab,
          item: entry
        }))
      }
    }
  
    return output
  }

  async getTab ({ league, tab }) {
    let cacheName = `${this.accountName}-${league}-tabs-${tab.id}`
    let cacheResult = this.cache.get(cacheName)
    if (cacheResult) {
      return this._convertTabItems({
        league,
        tab,
        items: cacheResult
      })
    }

    let apiResult = await Api.GetLeagueStashTab(this.accountSessionId, {
      accountName: this.accountName,
      league,
      tabIndex: tab.index,
      tabs: 0
    })

    let items = []

    // Rate limited, let's do a backoff
    if (apiResult.status === 429) {
      CC.checkRateLimitWindows(apiResult)
      throw ({ status: 429 })
    }

    // Not found
    if (apiResult.status === 404) 
      return items

    // Unauthorized
    if (apiResult.status === 403)
      throw ({ status: 403 })

    // Missing Data
    if (!apiResult.data || !apiResult.data.items)
      return items

    items = apiResult.data.items

    this.cache.set(cacheName, items, 60 * 4)
    this.cache.save()

    return this._convertTabItems({
      league,
      tab,
      items
    })
  }

  async getTabsList ({ league, skipCache }) {
    let cacheName = `${this.accountName}-${league}-tabs`
    if (!skipCache) {
      let cacheResult = this.cache.get(cacheName)
      if (cacheResult) {
        return cacheResult
      }
    }

    let apiResult = await Api.GetStashTabs(this.accountSessionId, {
      accountName: this.accountName,
      league
    })

    // Rate limited, let's do a backoff
    if (apiResult.status === 429) {
      CC.checkRateLimitWindows(apiResult)
      throw ({ status: 429 })
    }

    // Not found...
    if (apiResult.status === 404) 
      return {}

    // Unauthorized
    if (apiResult.status === 403)
      throw ({ status: 403 })

    this.cache.set(cacheName, apiResult, 60 * 15)
    this.cache.save()

    return apiResult
  }
}

export default ApiClient
