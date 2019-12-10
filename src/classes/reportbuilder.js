import { UUID, clone } from '../helpers';

import {
  DoServerRequest,
  GetAccountName,
  GetLeagues,
  GetCharacters,
  GetLeagueStashTab,
  currencyOverviews,
  itemOverviews
} from '../api';

const { GetCurrencyOverview, GetFragmentOverview } = currencyOverviews;
const {
  GetEssenceOverview,
  GetDivCardOverview,
  GetMapOverview,
  GetUniqueMapOverview,
  GetFossilOverview,
  GetResonatorOverview,
  GetProphecyOverview,
  GetIncubatorOverview,
  GetScarabOverview,
  GetOilOverview
} = itemOverviews;

class ReportBuilder {
  constructor(options) {
    this.additionalDelay = 60000;
    this.cookie = options.cookie;
    this.account = options.account;
    this.settings = options.settings;
    this.data = options.data;
    this.history = options.history || [];
    this.interval = null;
    this.fetching = false;
    this.id = UUID();
  }

  notice(message) {
    let reportName = this.settings.name;

    events.emit('notification', {
      message: `[${reportName}] ${message}`
    });
  }

  enableAutoRefresh() {
    if (this.interval) {
      clearInterval(this.interval);
    }

    if (this.settings.autoRefresh) {
      Log.info(
        `Enabling auto-refresh for [${this.settings.name}] interval of [${this.settings.autoRefreshInterval}]`
      );
      this.interval = setInterval(() => {
        Log.info(`Refreshing [${this.settings.name}]`);
        return this.refresh();
      }, this.settings.autoRefreshInterval);
    }
  }

  updateSettings(settings, fetchImmediately) {
    let previous = this.settings;
    this.settings = settings;
    this.enableAutoRefresh();

    if (fetchImmediately) {
      this.refresh();
    }
  }

  refresh() {
    return this.fetch().then(() => {
      events.emit('update_report', {
        report: this
      });
    });
  }

  buildItem(data) {
    let item = {};

    item.name = data.lineItem.currencyTypeName || data.lineItem.name;
    item.lname = item.name.toLowerCase();
    item.icon = data.lineItem.icon || data.details.icon;
    item.chaosValue = data.lineItem.chaosEquivalent || data.lineItem.chaosValue;
    item.orderId = data.details.poeTradeId || data.lineItem.id;
    item.type = data.type;

    if (data.lineItem.stackSize) {
      item.maxStackSize = data.lineItem.stackSize;
    }

    return item;
  }

  fetchTabsList() {
    return new Promise((resolve, reject) => {
      return GetLeagueStashTab(this.cookie, {
        accountName: this.account,
        tabIndex: 0,
        league: this.settings.league,
        tabs: 1
      })
        .then(response => {
          if (response.status === 404) {
            this.notice(
              `No tabs found in ${league} league. Try another one? 🤷`
            );
          }

          if (response.status === 403) {
            events.emit('clear_config');
            this.notice(`Session expired. You have been logged out.`);
          }

          if (!response.data || !response.data.tabs) {
            this.notice(
              `No tabs found in ${league} league. Try another one? 🤷`
            );
          } else if (response.status === 200) {
            return response;
          }

          throw null;
        })
        .then(response => {
          this.data.stashTabs = response.data.tabs;
          return resolve();
        })
        .catch(err => {
          throw err;
        });
    });
  }

  fetchTabs() {
    let queue = new Queue(1);
    let stash = this.data.stashTabs;

    for (var i = 0; i < stash.length; i++) {
      let tab = this.data.stashTabs[i];

      // Ignore hideout tabs
      if (tab.hidden) continue;

      // Ignore non-indexed tabs
      if (this.settings.tabsToSearch.indexOf(i) < 0) continue;

      // Ignore tab without data
      if (tab.wasProcessed)
        if (this.settings.onlySearchTabsWithCurrency && !tab.hasCurrency)
          continue;

      this.fetchTab(queue, tab);
    }

    return queue.push(() => {
      return true;
    });
  }

  fetchTab(queue, tab, delay) {
    delay = delay || 1350; // 60 / 45 (rate limited)
    queue.unshift(
      () =>
        new Promise((resolve, reject) => {
          return promiseDelay(delay)
            .then(() => {
              this.notice(`Fetching tab ${tab.n}...`);
            })
            .then(() => {
              return GetLeagueStashTab(this.cookie, {
                accountName: this.account,
                tabIndex: tab.i,
                league: this.settings.league,
                tabs: 0
              });
            })
            .then(response => {
              if (response.status === 429) {
                this.notice(
                  `Ooohwee, too many requests Jerry! Gonna have to wait a minute for tab ${tab.n}!`
                );
                return this.fetchTab(queue, tab, delay + this.additionalDelay);
              }

              if (response.status === 403) {
                events.emit('clear_config');
                this.notice(`Session expired. You have been logged out.`);
                throw null;
              }

              if (!response) {
                return resolve();
              }

              return response.data;
            })
            .then(response => {
              tab.items = response.items;
              return resolve();
            });
        })
    );
  }

  fetchRates() {
    return Promise.resolve()
      .then(() => this.notice('Fetching currency rates...'))
      .then(() => (this.data.rates = []))
      .then(() => this.fetchCurrencyRates('currency', GetCurrencyOverview))
      .then(() => this.fetchRate('essence', GetEssenceOverview))
      .then(() => this.fetchFragmentRates('fragment', GetFragmentOverview))
      .then(() => this.fetchDivCardRates('card', GetDivCardOverview))
      .then(() => this.fetchMapRates('map', GetMapOverview))
      .then(() => this.fetchUniqueMapRates('map_unique', GetUniqueMapOverview))
      .then(() => this.fetchFossilRates('fossil', GetFossilOverview))
      .then(() => this.fetchResonatorRates('resonator', GetResonatorOverview))
      .then(() => this.fetchProphecyRates('prophecy', GetProphecyOverview))
      .then(() => this.fetchIncubatorRates('incubator', GetIncubatorOverview))
      .then(() => this.fetchScarabRates('scarab', GetScarabOverview))
      .then(() => this.fetchOilRates('oil', GetOilOverview));
  }

  fetchRate(type, apiFn, queue) {
    let league = this.settings.league.replace('SSF ', '');

    return (queue || new Queue(1)).unshift(
      () =>
        new Promise((resolve, reject) => {
          return apiFn(league, getNinjaDate())
            .then(response => {
              return response.status !== 200
                ? this.fetchRate(type, apiFn, queue)
                : this.processFetchedRates(type, response.data);
            })
            .then(resolve)
            .catch(reject);
        })
    );
  }

  processFetchedRates(type, data) {
    return new Promise((resolve, reject) => {
      let rates = this.data.rates || [];

      let rateExists = itemName => {
        let litemName = itemName.toLowerCase();
        return rates.find(value => value.lname === litemName);
      };

      let getCurrencyDetailsItem = itemName => {
        return data.currencyDetails.find(value => value.name === itemName);
      };

      let getLineItemName = lineItem => {
        return data.currencyDetails ? lineItem.currencyTypeName : lineItem.name;
      };

      if (data.lines && data.lines.forEach) {
        data.lines.forEach(lineItem => {
          let exists = rateExists(getLineItemName(lineItem));

          // Entry already exists
          if (exists) {
            return;
          }

          let details = data.currencyDetails
            ? getCurrencyDetailsItem(lineItem.currencyTypeName)
            : {};

          rates.push(
            this.buildItem({
              lineItem,
              details,
              type
            })
          );
        });
      }

      this.data.rates = rates;

      return resolve();
    });
  }

  build(type, data) {
    let tabs = this.data.stashTabs;
    let items = clone(this.data.rates);

    // Helpers
    let getItemObject = itemName => {
      let litemName = itemName.toLowerCase();
      return items.find(value => {
        return litemName.indexOf(value.lname) > -1;
      });
    };

    // Iterate over each tab, then each tabs items
    if (tabs && tabs.forEach) {
      tabs.forEach((tab, i) => {
        // Ignore hideout tabs
        if (tab.hidden) return;

        // Ignore non-indexed tabs
        if (this.settings.tabsToSearch.indexOf(i) < 0) return;

        // Ignore tab without data
        if (tab.wasProcessed)
          if (this.settings.onlySearchTabsWithCurrency && !tab.hasCurrency)
            return;

        if (tab && tab.items && tab.items.forEach) {
          tab.items.forEach(item => {
            let reportItem = getItemObject(item.typeLine);

            // Chaos orb doesn't exist by default so we must create them.
            if (!reportItem && item.typeLine === 'Chaos Orb') {
              items.unshift({
                name: item.typeLine,
                lname: item.typeLine.toLowerCase(),
                icon:
                  'http://web.poecdn.com/image/Art/2DItems/Currency/CurrencyRerollRare.png?scale=1&w=1&h=1',
                orderId: 1,
                type: 'currency',
                chaosValue: 1,
                stackSize: item.stackSize,
                stacks: [
                  {
                    tab: tab.n,
                    stackSize: item.stackSize,
                    x: item.x,
                    y: item.y
                  }
                ]
              });
            }

            // Skip anything else
            if (!reportItem) {
              return;
            }

            // if (
            //    reportItem.type === 'card'
            // && !!reportItem.maxStackSize
            // && reportItem.maxStackSize > 0
            // && !reportItem.stackSizeChaosValue) {
            //   reportItem.stackSizeChaosValue = reportItem.chaosValue
            //   reportItem.chaosValue = parseFloat((reportItem.chaosValue / reportItem.maxStackSize).toFixed(2))
            //   reportItem.stackSize = 0
            // }

            // Ensure stack details exist
            if (!reportItem.stackSize) {
              reportItem.stackSize = 0;
            }

            if (!reportItem.stacks) {
              reportItem.stacks = [];
            }

            if (isNaN(reportItem.stackSize)) {
              reportItem.stackSize = 0;
            }

            reportItem.stackSize += item.stackSize || 1;
            reportItem.stacks.push({
              tab: tab.n,
              stackSize: item.stackSize,
              x: item.x,
              y: item.y
            });
          });
        }
      });
    }

    return items;
  }

  fetch(tabs, rates) {
    let { autoRefreshTabs, autoRefreshRates } = this.settings;

    return Promise.resolve()
      .then(() => (autoRefreshRates || rates ? this.fetchRates() : null))
      .then(() => (autoRefreshTabs || tabs ? this.fetchTabs() : null))
      .then(() => this.build())
      .then(report => {
        let reportTotal = 0;

        if (report && report.forEach) {
          report.forEach(item => {
            if (item.stackSize) {
              reportTotal += item.stackSize * item.chaosValue;
            }
          });
        }

        this.history.unshift({
          refreshedAt: Date.now(),
          refreshedTabs: tabs || autoRefreshTabs,
          refreshedRates: rates || autoRefreshRates,
          data: this.data,
          settings: this.settings,
          reportTotal,
          report
        });

        return this;
      })
      .catch(error => {
        if (!error) return;
        throw error;
      });
  }
}

ReportBuilder.defaultSettingsObject = function() {
  return {
    name: null,
    league: null,
    autoRefresh: false,
    autoRefreshInterval: 1000 * 60 * 60, // 1 hour
    autoRefreshRates: false,
    autoRefreshTabs: true,
    onlySearchTabsWithCurrency: false,
    tabsToSearch: []
  };
};

ReportBuilder.defaultDataObject = function() {
  return {
    stashTabs: null,
    rates: null
  };
};

module.exports = ReportBuilder;
