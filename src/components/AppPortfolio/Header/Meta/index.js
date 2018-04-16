import React, { PropTypes } from 'react'
import './index.css'

class HeaderMeta extends React.Component {
  render () {
    return (
      <div className="portfolio-meta">
        <div className="portfolio-meta-league">{ this.props.league }</div>
        <div className="portfolio-meta-last-updated">{ this.props.lastUpdated }</div>
      </div>
    )
  }
}

export default HeaderMeta
