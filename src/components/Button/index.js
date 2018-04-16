import React, { PropTypes } from 'react'
import styles from './index.css'

class Button extends React.Component {
  constructor (props) {
    super(props)
  }

  render () {
    let className = `btn`

    if (this.props.className) {
      className += ` ${this.props.className}`
    }

    return (
      <button {...this.props} onClick={this.props.onClick} className={className}>
        {this.props.children}
      </button>
    )
  }
}

export default Button