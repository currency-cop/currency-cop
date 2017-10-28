import React, { PropTypes } from 'react'
import styles from './index.css'

class Input extends React.Component {
  constructor (props) {
    super(props)
  }

  render () {
    return (
      <input type={this.props.type || 'text'} className={`form-input ${this.props.className}`} {...this.props} />
    )
  }
}

export default Input