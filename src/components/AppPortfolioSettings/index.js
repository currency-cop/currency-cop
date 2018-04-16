import React, { PropTypes } from 'react'

import './index.css'
import './forms.css'

import Select from 'react-select'
import Switch from 'react-flexible-switch'

import Button from '../Button'
import PrimaryButton from '../PrimaryButton'

class AppPortfolioSettings extends React.Component {
  render () {
    return (
      <div className="portfolio-settings">
        <h1>Portfolio Settings</h1>

        <div className="form-group">
          <h2>Portfolio Name</h2>
          <input name="name" type="text" value={this.state.settings.name} onChange={this.handleChange} />
          <Button onClick={this.handleNameGenerate}>Generate?</Button>
        </div>

        <div className="form-group">
          <h2>Portfolio League</h2>
          <Select 
            name="league"
            clearable={false}
            value={this.state.settings.league}
            onChange={this.handleLeagueChange}
            options={this.getLeagueList()} />
        </div>

        <div className="form-group">
          <h2>Portfolio Tabs</h2>
          <Select 
            name="tabs"
            multi={true}
            value={this.state.settings.tabs}
            onChange={this.handleTabChange}
            options={this.getLeagueTabList(this.state.settings.league)} />
        </div>

        <PrimaryButton onClick={this.handleSubmit}>Save</PrimaryButton>
      </div>
    )
  }

  static NAME_PREFIXES = [ 
    'Strong', 'Fast', 'Powerful', 'Bold', 'Quick', 'Nimble', 
    'Intense', 'Fixed', 'Long', 'Smart', 'Sweet', 'My', 'New' 
  ]

  static NAME_SUFFIXES = [ 
    'Exile', 'Tab', 'Folio', 'Tabs', 'Scion', 'Ranger', 'Witch', 
    'Marauder', 'Shadow', 'Templar', 'Gangsta', 'Trade'
  ]

  constructor (props) {
    super(props)

    // Bindings
    this.handleLeagueChange = this.handleLeagueChange.bind(this)
    this.handleTabChange = this.handleTabChange.bind(this)
    this.handleChange = this.handleChange.bind(this)
    this.handleSubmit = this.handleSubmit.bind(this)
    this.generateName = this.generateName.bind(this)

    // Setup state
    let {portfolio} = this.props
    this.state = {
      settings: portfolio ? portfolio.settings : {
        name: this.generateName(),
        league: this.props.leagues[0].id,
        tracking: []
      }
    }
  }

  getRandomElement (list) {
    return list[Math.floor(Math.random() * list.length)]
  }

  generateName () {
    let {NAME_PREFIXES, NAME_SUFFIXES} = AppPortfolioSettings
    let prefix = this.getRandomElement(NAME_PREFIXES)
    let suffix = this.getRandomElement(NAME_SUFFIXES)
    return `${prefix} ${suffix}`
  }

  handleChange (e) {
    e.preventDefault()

    let name = e.target.name
    let value = e.target.value

    if (e.target.type === 'checkbox') { 
      value = e.target.checked 
    }

    this.setState({
      settings: {
        [name]: value
      }
    })
  }

  handleLeagueChange (option) {
    let value = option ? option.value : ''
    this.setState({
      settings: {
        ...this.state.settings,
        tabs: null,
        league: value
      }
    })
  }

  handleTabChange (tabs) {
    this.setState({
      settings: {
        ...this.state.settings,
        tabs
      }
    })
  }

  handleNameGenerate () {
    let name = this.generateName()
    this.setState({
      settings: {
        ...this.state.settings,
        name
      }
    })
  }

  handleSubmit (e) {
    e.preventDefault()

    if (this.props.portfolio) {
      return this.handleUpdate
    }

    return this.handleCreate()
  }

  handleCreate () {
    try {
      CC.Events.emit('/portfolio/create', {
        portfolio: this.state.settings
      })

      CC.Events.emit('/screen/dashboard')
    } catch (e) {
      console.log(e)
    }
  }

  handleUpdate () {

  }

  getLeagueList () {
    return this.props.leagues.map((league, index) => {
      return {
        value: league.id,
        label: league.id
      }
    })
  }

  getLeagueTabList (league) {
    let tabs = this.props.tabs[league]
    return tabs.map((tab, index) => {
      return {
        value: tab.id,
        label: tab.name,
        style: {
          color: `rgb(${tab.color[0]}, ${tab.color[1]}, ${tab.color[2]})`
        }
      }
    })
  }
}

export default AppPortfolioSettings
