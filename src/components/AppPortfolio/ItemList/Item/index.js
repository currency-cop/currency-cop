import React from 'react'
import './index.css'

import { formatNumber } from '@/helpers'
import Item from '@/classes/item'

class ItemRow extends React.Component {
  render () {
    let {details} = this.props
    if (!details[1]) return

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
        <td className="item-name">{Item.getReportItemName(details)}</td>
        <td className="item-quantity">{formatNumber(details[3], 0)}</td>
        <td className="item-price">{formatNumber(details[4])} C</td>
        <td className="item-total">{formatNumber(details[5])} C</td>
      </tr>
    )
  }
}

export default ItemRow
