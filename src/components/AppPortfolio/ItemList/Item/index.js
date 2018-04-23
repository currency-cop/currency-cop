import React, { PropTypes } from 'react'
import './index.css'

class Item extends React.Component {
  render () {
    let {details} = this.props
    if (!details.item.fullName) {
      return
    }

    return (
      <tr>
        <td>
          <img 
            src={details.price.icon || details.item.icon}
            width={32}
            style={{ verticalAlign: 'middle' }}
            title={details.item.fullName}
          />
        </td>
        <td>{details.item.fullName}</td>
        <td>{details.stackSize}</td>
        <td>{details.chaosValue.toFixed(2)} C</td>
      </tr>
    )
  }
}

export default Item
