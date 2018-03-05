import { ipcRenderer } from 'electron'
import Constants from './constants'
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
      if (response.status > 200) {
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
        CC.ApiLog.warn(`${response.status} status response for [${options.url}]: ${JSON.stringify(response.data)}`)
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


function LoginWithCookie (cookie) {
  return DoServerRequest({
    method: 'get',
    url: Constants.POE_LOGIN_URL,
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
    if (response.status === 404) 
      return []

    if (response.status === 403)
      throw new Error({ status: 403 })

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

function GetCurrencyOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_CURRENCY_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'CURRENCY_RESPONSE',
    onError: 'CURRENCY_ERROR'
  })
}

function GetEssenceOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_ESSENCE_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'ESSENCE_RESPONSE',
    onError: 'ESSENCE_ERROR'
  })
}

function GetFragmentOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_FRAGMENT_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'FRAGMENT_RESPONSE',
    onError: 'FRAGMENT_ERROR'
  })
}

function GetDivCardOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_DIV_CARDS_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'DIV_CARD_RESPONSE',
    onError: 'DIV_CARD_ERROR'
  })
}

function GetMapOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_MAP_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'MAP_RESPONSE',
    onError: 'MAP_ERROR'
  })
}

function GetUniqueMapOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_UNIQUE_MAP_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'UNIQUE_MAP_RESPONSE',
    onError: 'UNIQUE_MAP_ERROR'
  })
}

function GetUniqueJewelOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_UNIQUE_JEWEL_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'UNIQUE_JEWEL_RESPONSE',
    onError: 'UNIQUE_JEWEL_ERROR'
  })
}

function GetUniqueFlaskOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_UNIQUE_FLASK_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'UNIQUE_FLASK_RESPONSE',
    onError: 'UNIQUE_FLASK_ERROR'
  })
}

function GetUniqueArmourOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_UNIQUE_ARMOUR_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'UNIQUE_ARMOUR_RESPONSE',
    onError: 'UNIQUE_ARMOUR_ERROR'
  })
}

function GetUniqueWeaponOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_UNIQUE_WEAPON_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'UNIQUE_WEAPON_RESPONSE',
    onError: 'UNIQUE_WEAPON_ERROR'
  })
}

function GetUniqueAccessoryOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_UNIQUE_ACCESSORY_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'UNIQUE_ACCESSORY_RESPONSE',
    onError: 'UNIQUE_ACCESSORY_ERROR'
  })
}

function DoVersionCheck () {
  return DoServerRequest({
    method: 'get',
    url: `https://poe.technology/latest`,
    onSuccess: 'VERSION_CHECK_RESPONSE',
    onError: 'VERSION_CHECK_ERROR'
  })
}


// Exports
exports.DoServerRequest = DoServerRequest
exports.LoginWithCookie = LoginWithCookie
exports.GetAccountName = GetAccountName
exports.GetLeagues = GetLeagues
exports.GetCharacters = GetCharacters
exports.GetStashTabs = GetStashTabs
exports.GetLeagueStashTab = GetLeagueStashTab
exports.GetCurrencyOverview = GetCurrencyOverview
exports.GetEssenceOverview = GetEssenceOverview
exports.GetFragmentOverview = GetFragmentOverview
exports.GetDivCardOverview = GetDivCardOverview
exports.GetMapOverview = GetMapOverview
exports.GetUniqueMapOverview = GetUniqueMapOverview
exports.GetUniqueJewelOverview = GetUniqueJewelOverview
exports.GetUniqueAccessoryOverview = GetUniqueJewelOverview
exports.GetUniqueArmourOverview = GetUniqueArmourOverview
exports.GetUniqueFlaskOverview = GetUniqueFlaskOverview
exports.DoVersionCheck = DoVersionCheck

// Enums
exports.ItemRateTypes = {
  currency: GetCurrencyOverview,
  essence: GetEssenceOverview,
  fragment: GetFragmentOverview,
  card: GetDivCardOverview,
  map: GetMapOverview,
  unique_map: GetUniqueMapOverview,
  unique_jewel: GetUniqueJewelOverview,
  unique_flask: GetUniqueFlaskOverview,
  unique_armour: GetUniqueArmourOverview,
  unique_weapon: GetUniqueWeaponOverview,
  unique_accessory: GetUniqueAccessoryOverview
}