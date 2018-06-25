import React from 'react'
import './index.css'

import { formatNumber } from '@/helpers'

class Item extends React.Component {
  render () {
    let {details} = this.props
    if (!details[1]) return

    let links = details[6] !== 0 ? `(${details[6]}-link)` : ''

    return (
      <tr>
        <td className="item-icon">
          <img 
            src={details[0]}
            width={32}
            style={{ verticalAlign: 'middle' }}
            title={details[1]}
          />
        </td>
        <td className="item-name">{details[1]} {details[2]} {links}</td>
        <td className="item-quantity">{formatNumber(details[3], 0)}</td>
        <td className="item-price">{formatNumber(details[4])} C</td>
        <td className="item-total">{formatNumber(details[5])} C</td>
      </tr>
    )
  }
}

export default Item
