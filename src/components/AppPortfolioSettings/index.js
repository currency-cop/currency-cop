import React, { PropTypes } from 'react'

import './index.css'
import './forms.css'

import Select from 'react-select'

import Button from '../Button'
import PrimaryButton from '../PrimaryButton'

class AppPortfolioSettings extends React.Component {
  render () {
    return (
      <div className="portfolio-settings">
        <h1>{this.getFormTitle()}</h1>

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

        <div className="right">
          <Button onClick={this.handleDelete}>Delete</Button>
        </div>
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
    this.handleNameGenerate = this.handleNameGenerate.bind(this)
    this.handleLeagueChange = this.handleLeagueChange.bind(this)
    this.handleTabChange = this.handleTabChange.bind(this)
    this.handleChange = this.handleChange.bind(this)
    this.handleSubmit = this.handleSubmit.bind(this)
    this.handleDelete = this.handleDelete.bind(this)

    let { portfolio } = this.props

    // Setup state
    this.state = {
      settings: portfolio ? {...portfolio} : {
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

  getFormTitle () {
    if (this.props.portfolio) {
      return 'Updating Portfolio'
    }

    return 'Create Portfolio'
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
        ...this.state.settings,
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
      return this.handleUpdate()
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
    try {
      CC.Events.emit('/portfolio/update', {
        portfolio: this.state.settings
      })

      CC.Events.emit('/screen/portfolio', {
        portfolioId: this.state.settings.id
      })
    } catch (e) {
      console.log(e)
    }
  }

  handleDelete () {
    try {
      CC.Events.emit('/portfolio/delete', {
        portfolio: this.state.settings
      })

      CC.Events.emit('/screen/dashboard')
    } catch (e) {
      console.log(e)
    }
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
    if (!tabs) {
      return []
    }

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

import { hot } from 'react-hot-loader'
export default hot(module)(AppPortfolioSettings)
