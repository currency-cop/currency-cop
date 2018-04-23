import React, { PropTypes } from 'react'
import Helpers from '@/helpers'
import Ago from '@/classes/ago'

import './index.css'

class Dropdown extends React.Component {
  render () {
    let {selected, list} = this.props

    return (
      <div className={this.getContainerClassName()}>
        <div className={this.getDropdownClassName()} onClick={ this.show }>
          {list[selected].displayContent}
          <i className="material-icons">&#xE5C5;</i>
        </div>

        <div className="dropdown-list">
          <div>
            {this.renderListItems()}
          </div>
        </div>
      </div>
    )
  }

  renderListItems () {
    return this.props.list.map((item, index) => {
      return (
        <div 
          key={item.createdAt} 
          className={`${this.props.selected === index ? 'selected' : ''}`}
          onClick={(e) => this.select(item)}>
          {item.dropdownContent}
        </div>
      )
    })
  }

  constructor (props) {
    super(props)

    this.show = this.show.bind(this)
    this.hide = this.hide.bind(this)
    this.select = this.select.bind(this)

    this.state = {
      listVisible: false
    }
  }

  select (selected) {
    // ...
  }

  show () {
    this.setState({ listVisible: true })
    document.addEventListener("click", this.hide)
  }

  hide () {
    this.setState({ listVisible: false })
    document.removeEventListener("click", this.hide)
  }

  getContainerClassName () {
    return `dropdown-container ${this.state.listVisible ? " show" : ""}`
  }

  getDropdownClassName () {
    return `dropdown-container ${this.state.listVisible ? " clicked": ""}`
  }
}

class HeaderMeta extends React.Component {
  render () {
    return (
      <div className="portfolio-meta">
        <div className="portfolio-meta-league">{ this.props.league }</div>

        <Dropdown
          list={this.getHistoryList()}
          selected={0} />
      </div>
    )
  }

  getHistoryList () {
    let list = this.props.history.map(item => item)

    return list.reverse().splice(0, 5).map((item, index) => {
      return {
        index,
        createdAt: item.createdAt,

        displayContent: (
          <span>{ Ago(item.createdAt) }</span>
        ),

        dropdownContent: (
          <div className="dropdown-item">
            <span className="total">{ Helpers.formatNumber(item.total) } C</span>
            <span className="time"><br />{ 
              (new Date(item.createdAt)).toLocaleString('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: '2-digit',
                hour: 'numeric', 
                minute: '2-digit'
              })
            }</span>
          </div>
        )
      }
    })
  }
}

export default HeaderMeta
