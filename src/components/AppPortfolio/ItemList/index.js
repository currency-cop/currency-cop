import React, { PropTypes } from 'react'
import './index.css'

import Item from './Item'

class PortfolioItemList extends React.Component {
  render () {
    return (
      <div className="items">
        <table className="not-draggable">
          <thead>
            <tr>
              <th><div>Icon</div></th>
              <th><div>Item Name</div></th>
              <th><div>Quantity</div></th>
              <th><div>Value</div></th>
            </tr>
          </thead>
          <tbody>
            { this.renderItems() }
          </tbody>
        </table>
      </div>
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
