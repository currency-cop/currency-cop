import Api from '../api'
import Helpers from '../helpers'
import CacheFile from './cachefile'
import Constants from '../constants'

class ApiClient {
  constructor (options = {}) {
    this.log = CC.Logger.topic('ApiClient')
    this.cache = new CacheFile('ApiClientCache', options.cacheFileLocation)
    this.accountName = options.accountName
    this.accountSessionId = options.accountSessionId
  }

  async authorize ({ sessionId }) {
    let sessionResponse = await Api.LoginWithCookie(sessionId)
    if (sessionResponse.status != 302) {
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
        message: `Invalid response from server, try refreshing your session id.`
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
    league = league.replace('SSF ', '')

    let itemRatesCacheName = `${this.accountName}-rates-${type}-${league}`
    let itemRatesCache = this.cache.get(itemRatesCacheName)
    if (itemRatesCache) {
      return itemRatesCache
    }

    let date = Helpers.getNinjaDate()
    let response = await Api.ItemRateTypes[type](league, date)

    // Only retry at maximum, once.
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
    let output = []
    let list = response.data.lines
    if (list && list.length) {
      for (const entry of list) {
        let name = entry.currencyTypeName || entry.name
        let item = {
          type: type,
          icon: entry.icon,
          name: name,
          nameLowercase: name.toLowerCase(),
          baseType: entry.baseType,
          stackSize: entry.stackSize,
          chaosValue:  entry.chaosEquivalent || entry.chaosValue
        }

        output.push(item)
      }
    }

    this.cache.set(itemRatesCacheName, list, 60 * 60 * 24)
    this.cache.save()

    return list
  }

  async getTab ({ league, tab, tabId }) {
    let cacheName = `${this.accountName}-${league}-tabs-${tabId}`
    let cacheResult = this.cache.get(cacheName)
    if (cacheResult) {
      return cacheResult
    }

    let apiResult = await Api.GetLeagueStashTab(this.accountSessionId, {
      accountName: this.accountName,
      league,
      tabIndex: tab,
      tabs: 0
    })

    let items = []

    if (apiResult.status === 404 || apiResult.status === 429) 
      return items

    if (apiResult.status === 403)
      throw new Error({ status: 403 })

    if (!apiResult.data || !apiResult.data.items)
      return items

    items  = apiResult.data.items

    this.cache.set(cacheName, items, 60 * 4)
    this.cache.save()

    return items
  }

  async getTabsList ({ league }) {
    let cacheName = `${this.accountName}-${league}-tabs`
    let cacheResult = this.cache.get(cacheName)
    if (cacheResult) {
      return cacheResult
    }

    let apiResult = await Api.GetStashTabs(this.accountSessionId, {
      accountName: this.accountName,
      league
    })

    this.cache.set(cacheName, apiResult, 60 * 15)
    this.cache.save()

    return apiResult
  }
}

module.exports = ApiClient