import { ipcRenderer } from 'electron'
import * as Constants from './constants'
import { UUID } from './helpers'


function DoServerRequest (options) {
  // Prevent collision
  let uuid = UUID()
  options.onSuccess += `_${uuid}`
  options.onError += `_${uuid}`

  // Make request
  console.debug(`Making HTTP request to: ${options.url}`)
  console.debug(`Request options`, options)
  ipcRenderer.send('HTTP_REQUEST', options)

  return new Promise((resolve, reject) => {
    ipcRenderer.once(options.onSuccess, (event, response) => {
      if (response && response.status > 200) {
        // The request was made and the server responded with a status code
        // that is not 200
        CC.ApiLog.warn(`${response.status} status response for [${options.url}]: ${JSON.stringify(response.data)}`)
      }

      return resolve(response)
    })

    ipcRenderer.once(options.onError, (event, error) => {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        CC.ApiLog.warn(`${error.response.status} status response for [${options.url}]: ${JSON.stringify(error.response.data)}`)
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        CC.ApiLog.error(`Request sent to [${options.url}], no response received: ${error.message}`)
      } else {
        // Something happened in setting up the request that triggered an Error
        CC.ApiLog.error(`Unable to make HTTP request to [${options.url}]: ${error.message}`)
      }

      return reject(error)
    })
  })
}


function DoVersionCheck () {
  return DoServerRequest({
    method: 'get',
    url: `https://api.github.com/repos/currency-cop/currency-cop/releases`,
    onSuccess: 'VERSION_CHECK_RESPONSE',
    onError: 'VERSION_CHECK_ERROR'
  })
}

function LoginWithCookie (cookie) {
  return DoServerRequest({
    method: 'get',
    url: Constants.POE_MY_ACCOUNT_URL,
    options: {
      headers: {
        'Cookie': `${Constants.POE_COOKIE_NAME}=${cookie}`
      },
      maxRedirects: 0
    },
    onSuccess: 'LOGIN_RESPONSE',
    onError: 'LOGIN_ERROR'
  })
}

function GetAccountName (cookie) {
  return DoServerRequest({
    method: 'get',
    url: Constants.POE_MY_ACCOUNT_URL,
    options: {
      headers: {
        'Cookie': `${Constants.POE_COOKIE_NAME}=${cookie}`
      }
    },
    onSuccess: 'MY_ACCOUNT_RESPONSE',
    onError: 'MY_ACCOUNT_ERROR'
  })
}

function GetLeagues () {
  return DoServerRequest({
    method: 'get',
    url: Constants.POE_LEAGUE_LIST_URL,
    options: {},
    onSuccess: 'LEAGUE_LIST_RESPONSE',
    onError: 'LEAGUE_LIST_ERROR'
  })
}

function GetCharacters (cookie, accountName) {
  return DoServerRequest({
    method: 'get',
    url: Constants.POE_GET_CHARACTERS_URL,
    options: {
      headers: {
        'Cookie': `${Constants.POE_COOKIE_NAME}=${cookie}`
      }
    },
    onSuccess: 'CHARACTERS_RESPONSE',
    onError: 'CHARACTERS_ERROR'
  })
}

function GetStashTabs (cookie, options) {
  options.tabs = 1
  options.tabIndex = 0

  return GetLeagueStashTab(cookie, options).then(response => {
    if (response.status === 429)
      return response

    if (response.status === 404)
      return []

    if (response.status === 403)
      return response

    if (!response.data || !response.data.tabs)
      return []

    // Return filtered tab list
    return response.data.tabs.map(tab => {
      return tab.hidden ? undefined : {
        id: tab.id,
        name: tab.n,
        index: tab.i,
        color: [tab.colour.r, tab.colour.g, tab.colour.b]
      }
    })
  })
}

function GetLeagueStashTab (cookie, options) {
  return DoServerRequest({
    method: 'get',
    url: Constants.POE_STASH_ITEMS_URL,
    options: {
      headers: {
        'Cookie': `${Constants.POE_COOKIE_NAME}=${cookie}`
      },
      params: options
    },
    onSuccess: `STASH_TAB_RESPONSE`,
    onError: `STASH_TAB_ERROR`
  })
}

function GetNinjaCurrency (type, league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_CURRENCY_URL,
    options: {
      params: {
        type,
        league,
        date
      }
    },
    onSuccess: 'CURRENCY_RESPONSE',
    onError: 'CURRENCY_ERROR'
  })
}

function GetNinjaItem (type, league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_ITEM_URL,
    options: {
      params: {
        type,
        league,
        date
      }
    },
    onSuccess: `${type}_RESPONSE`,
    onError: `${type}_ERROR`
  })
}

// Generate Overviews
Constants.NINJA_CURRENCY_OVERVIEWS.forEach(type => {
  exports[`Get${type}Overview`] = (league, date) => GetNinjaCurrency(type, league, date)
})

Constants.NINJA_ITEM_OVERVIEWS.forEach(type => {
  exports[`Get${type}Overview`] = (league, date) => GetNinjaItem(type, league, date)
})

// Custom Overviews
exports.GetDivCardOverview = (league, date) => GetNinjaItem('DivinationCard', league, date)

// Exports
exports.DoServerRequest = DoServerRequest
exports.LoginWithCookie = LoginWithCookie
exports.GetAccountName = GetAccountName
exports.GetLeagues = GetLeagues
exports.GetCharacters = GetCharacters
exports.GetStashTabs = GetStashTabs
exports.GetLeagueStashTab = GetLeagueStashTab
exports.DoVersionCheck = DoVersionCheck

// Enums
exports.ItemRateTypes = {
  currency: exports.GetCurrencyOverview,
  essence: exports.GetEssenceOverview,
  fragment: exports.GetFragmentOverview,
  card: exports.GetDivCardOverview,
  map: exports.GetMapOverview,
  gem: exports.GetSkillGemOverview,
  unique_map: exports.GetUniqueMapOverview,
  unique_jewel: exports.GetUniqueJewelOverview,
  unique_flask: exports.GetUniqueFlaskOverview,
  unique_armour: exports.GetUniqueArmourOverview,
  unique_weapon: exports.GetUniqueWeaponOverview,
  unique_accessory: exports.GetUniqueAccessoryOverview,
  fossil: exports.GetFossilOverview,
  resonator: exports.GetResonatorOverview,
  prophecy: exports.GetProphecyOverview
}
