module.exports = {
  CONFIG_USERNAME:                      'ACCOUNT_USERNAME',
  CONFIG_COOKIE:                        'ACCOUNT_COOKIE',

  RELEASES_URL:                         'https://poe.technology/releases',
  SESSION_URL:                          'https://www.pathofexile.com/forum/view-thread/1989935/page/9#p14857124',

  POE_MAIN_PAGE_URL:                    'https://www.pathofexile.com/',
  POE_LOGIN_URL:                        'https://www.pathofexile.com/login',
  POE_LOGIN_STEAM_URL:                  'https://www.pathofexile.com/login/steam',
  POE_MY_ACCOUNT_URL:                   'https://www.pathofexile.com/my-account',
  POE_GET_CHARACTERS_URL:               'https://www.pathofexile.com/character-window/get-characters',
  POE_STASH_ITEMS_URL:                  `https://www.pathofexile.com/character-window/get-stash-items`,
  POE_LEAGUE_LIST_URL:                  'http://api.pathofexile.com/leagues?type=main&compact=1',

  POE_COOKIE_NAME:                      'POESESSID',
  POE_COOKIE_REGEXP:                    /^[0-9A-Fa-f]{32}$/,
  POE_ACCOUNT_NAME_REGEXP:              /\/account\/view-profile\/(.*?)\"/,

  NINJA_CURRENCY_OVERVIEW_URL:          'http://api.poe.ninja/api/Data/GetCurrencyOverview',
  NINJA_FRAGMENT_OVERVIEW_URL:          'http://api.poe.ninja/api/Data/GetFragmentOverview',
  NINJA_ESSENCE_OVERVIEW_URL:           'http://api.poe.ninja/api/Data/GetEssenceOverview',

  NINJA_MAP_OVERVIEW_URL:               'http://api.poe.ninja/api/Data/GetMapOverview',
  NINJA_UNIQUE_MAP_OVERVIEW_URL:        'http://api.poe.ninja/api/Data/GetUniqueMapOverview',
  NINJA_DIV_CARDS_OVERVIEW_URL:         'http://api.poe.ninja/api/Data/GetDivinationCardsOverview',

  NINJA_UNIQUE_JEWEL_OVERVIEW_URL:      'http://api.poe.ninja/api/Data/GetUniqueJewelOverview',
  NINJA_UNIQUE_FLASK_OVERVIEW_URL:      'http://api.poe.ninja/api/Data/GetUniqueFlaskOverview',
  NINJA_UNIQUE_WEAPON_OVERVIEW_URL:     'http://api.poe.ninja/api/Data/GetUniqueWeaponOverview',
  NINJA_UNIQUE_ARMOUR_OVERVIEW_URL:     'http://api.poe.ninja/api/Data/GetUniqueArmourOverview',
  NINJA_UNIQUE_ACCESSORY_OVERVIEW_URL:  'http://api.poe.ninja/api/Data/GetUniqueAccessoryOverview',
}