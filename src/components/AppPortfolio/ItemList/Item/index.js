import React from 'react'
import './index.css'

import { formatNumber } from '@/helpers'

class Item extends React.Component {
  render () {
    let {details} = this.props
    if (!details.item.fullName) {
      return
    }

    return (
      <tr>
        <td className="item-icon">
          <img 
            src={details.price.icon || details.item.icon}
            width={32}
            style={{ verticalAlign: 'middle' }}
            title={details.item.fullName}
          />
        </td>
        <td className="item-name">{details.item.fullName}</td>
        <td className="item-quantity">{formatNumber(details.stackSize, 0)}</td>
        <td className="item-price">{formatNumber(details.price.chaosValue)} C</td>
        <td className="item-total">{formatNumber(details.chaosValue)} C</td>
      </tr>
    )
  }
}

export default Item
