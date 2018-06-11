import React, { PropTypes } from 'react'
import './index.css'

class Card extends React.Component {
  render () {
    return (
      <div className={`Card ${this.props.className}`}>
        {this.props.children}
      </div>
    )
  }
}

class CardHeader extends React.Component {
  render () {
    return (
      <div className={`CardHeader ${this.props.className}`}>
        <h3>{this.props.title}</h3>
        {this.props.children}
      </div>
    )
  }
}

class CardContent extends React.Component {
  render () {
    return (
      <div className={`CardContent ${this.props.className}`}>
        {this.props.children}
      </div>
    )
  }
}

export {
  CardContent,
  CardHeader,
  Card
}