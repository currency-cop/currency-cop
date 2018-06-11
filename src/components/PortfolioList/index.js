import React, { PropTypes } from 'react'
import AppSidebarPortfolioListItem from './PortfolioListItem'

import './index.css'

class AppSidebarPortfolioList extends React.Component {
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
          <AppSidebarPortfolioListItem
            index={index}
            viewing={this.props.portfolioId}
            portfolio={portfolio} />
        </li>
      )
    })
  }
}

export default AppSidebarPortfolioList