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
        ApiLog.warn(`${response.status} status response for [${options.url}]: ${JSON.stringify(response.data)}`)
      }

      return resolve(response)
    })

    ipcRenderer.once(options.onError, (event, error) => {
      if (error.response) {
        // The request was made and the server responded with a status code 
        // that falls out of the range of 2xx
        ApiLog.warn(`${response.status} status response for [${options.url}]: ${JSON.stringify(response.data)}`)
      } else if (error.request) {
        // The request was made but no response was received 
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of 
        // http.ClientRequest in node.js
        ApiLog.error(`Request sent to [${options.url}], no response received: ${error.message}`)
      } else {
        // Something happened in setting up the request that triggered an Error
        ApiLog.error(`Unable to make HTTP request to [${options.url}]: ${error.message}`)
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

function DoVersionCheck () {
  return DoServerRequest({
    method: 'get',
    url: `https://poe.technology/latest`,
    onSuccess: 'VERSION_CHECK_RESPONSE',
    onError: 'VERSION_CHECK_ERROR'
  })
}

// TODO: Convert into an object.
exports.DoServerRequest = DoServerRequest
exports.LoginWithCookie = LoginWithCookie
exports.GetAccountName = GetAccountName
exports.GetLeagues = GetLeagues
exports.GetCharacters = GetCharacters
exports.GetLeagueStashTab = GetLeagueStashTab
exports.GetCurrencyOverview = GetCurrencyOverview
exports.GetEssenceOverview = GetEssenceOverview
exports.GetFragmentOverview = GetFragmentOverview
exports.GetDivCardOverview = GetDivCardOverview
exports.GetMapOverview = GetMapOverview
exports.GetUniqueMapOverview = GetUniqueMapOverview
exports.DoVersionCheck = DoVersionCheck