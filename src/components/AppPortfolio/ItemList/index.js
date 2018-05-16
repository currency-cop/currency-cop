import React, { PropTypes } from 'react'
import './index.css'

import Item from './Item'

class PortfolioItemList extends React.Component {
  render () {
    return (
      <table>
        <thead>
          <tr>
            <th>Icon</th>
            <th>Item Name</th>
            <th>Quantity</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          { this.renderItems() }
        </tbody>
      </table>
    )
  }

  renderItems () {
    return this.props.items.map((details, index) => {
      return (
        <Item 
          key={`${this.props.id}-${index}-${details.item.fullName}`}
          details={details} />
      )
    })
  }
}

export default PortfolioItemList
