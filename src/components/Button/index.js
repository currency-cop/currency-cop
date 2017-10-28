import React, { PropTypes } from 'react'
import styles from './index.css'

class Button extends React.Component {
  constructor (props) {
    super(props)
  }

  render () {
    let className = `btn ${this.props.className}`
    console.log(this.props)
    return (
      <button {...this.props} onClick={this.props.onClick} className={className}>
        {this.props.children}
      </button>
    )
  }
}

export default Button