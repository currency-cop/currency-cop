import React, { PropTypes } from 'react'
import Button from '../Button'
import styles from './index.css'

class PrimaryButton extends React.Component {
  constructor (props) {
    super(props)
  }

  render () {
    let className = `btn-primary ${this.props.className || ''}`

    return (
      <Button className={className} {...this.props} />
    )
  }
}

export default PrimaryButton