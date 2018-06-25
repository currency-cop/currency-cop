import React, { PropTypes } from 'react'
import PortfolioItem from '../Item'
import styles from './index.css'

class PortfolioList extends React.Component {
  render () {
    return (
      <ul className="portfolio-list">
        { this.renderList() }
      </ul>
    )
  }

  renderList () {
    return this.props.portfolios.map((portfolio, index) => {
      return (
        <li key={ portfolio.name }>
          <PortfolioItem
            index={index}
            viewing={this.props.portfolioId}
            portfolio={portfolio} />
        </li>
      )
    })
  }
}

export default PortfolioList