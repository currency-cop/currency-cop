import React, { PropTypes } from 'react'
import './index.css'

import Item from './Item'

class PortfolioItemList extends React.Component {
  constructor (props) {
    super(props)

    this.sortByName = this.sortByName.bind(this)
    this.sortByQuantity = this.sortByQuantity.bind(this)
    this.sortByPrice = this.sortByPrice.bind(this)
    this.sortByTotal = this.sortByTotal.bind(this)

    this.state = {
      sortBy: 'total-desc',
      sort: null
    }
  }

  render () {
    return (
      <table>
        <thead>
          <tr>
            <th>Icon</th>
            <th onClick={this.sortByName}>Item Name {this.isSortedBy('name')}</th>
            <th onClick={this.sortByQuantity}>Quantity {this.isSortedBy('quantity')}</th>
            <th onClick={this.sortByPrice}>Price {this.isSortedBy('price')}</th>
            <th onClick={this.sortByTotal}>Total {this.isSortedBy('total')}</th>
          </tr>
        </thead>
        <tbody>
          { this.renderItems() }
        </tbody>
      </table>
    )
  }

  isSortedBy (name) {
    if (this.state.sortBy && this.state.sortBy.indexOf(name) > -1) {
      if (this.state.sortBy.split('-')[1] === 'asc') {
        return (<i className="material-icons">&#xe5c7;</i>)
      }
  
      return (<i className="material-icons">&#xE5C5;</i>)
    }

    return ``
  }

  sortBy (name, asc, desc) {
    let sortBy = this.state.sortBy === `${name}-asc`
      ? `${name}-desc`
      : `${name}-asc`

    let sort = this.state.sortBy === `${name}-asc`
      ? desc
      : asc

    this.setState({
      sortBy,
      sort
    })
  }

  sortByQuantity () {
    this.sortBy('quantity', (a, b) => {
      return a[3] - b[3]
    }, (a, b) => {
      return b[3] - a[3]
    })
  }

  sortByPrice () {
    this.sortBy('price', (a, b) => {
      return a[4] - b[4]
    }, (a, b) => {
      return b[4] - a[4]
    })
  }

  sortByTotal () {
    this.sortBy('total', (a, b) => {
      return a[5] - b[5]
    }, (a, b) => {
      return b[5] - a[5]
    })
  }

  getItemName (item) {
    let links = item[6] !== 0 ? `(${item[6]}-link)` : ''
    let variant = item[2]
    return `${item[1]} ${item[2]} ${links}`
  }

  sortByName () {
    this.sortBy('name', (a, b) => {
      return this.getItemName(a).localeCompare(this.getItemName(b))
    }, (a, b) => {
      return this.getItemName(b).localeCompare(this.getItemName(a))
    })
  }

  renderItems () {
    let items = this.props.items

    if (this.state.sort) {
      items = items.sort(this.state.sort)
    }

    return items.map((details, index) => {
      return (
        <Item 
          key={`${this.props.id}-${index}-${details[1]}`}
          details={details} />
      )
    })
  }
}

export default PortfolioItemList
