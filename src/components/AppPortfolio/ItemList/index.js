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
      return a.stackSize - b.stackSize
    }, (a, b) => {
      return b.stackSize - a.stackSize
    })
  }

  sortByPrice () {
    this.sortBy('price', (a, b) => {
      return a.price.chaosValue - b.price.chaosValue
    }, (a, b) => {
      return b.price.chaosValue - a.price.chaosValue
    })
  }

  sortByTotal () {
    this.sortBy('total', (a, b) => {
      return a.chaosValue - b.chaosValue
    }, (a, b) => {
      return b.chaosValue - a.chaosValue
    })
  }

  sortByName () {
    this.sortBy('name', (a, b) => {
      return a.item.fullName.localeCompare(b.item.fullName)
    }, (a, b) => {
      return b.item.fullName.localeCompare(a.item.fullName)
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
          key={`${this.props.id}-${index}-${details.item.fullName}`}
          details={details} />
      )
    })
  }
}

export default PortfolioItemList
