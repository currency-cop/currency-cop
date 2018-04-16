import React, { PropTypes } from 'react'
import AppSidebarPortfolioListItem from '../AppSidebarPortfolioListItem'
import styles from './index.css'

class AppSidebarPortfolioList extends React.Component {
  render () {
    return (
      <ul className="portfolio-list">
        { 
          this.props.portfolios.map((portfolio, index) => {
            return (
              <li key={ portfolio.name }>
                <AppSidebarPortfolioListItem
                  index={index}
                  portfolio={portfolio} />
              </li>
            )
          })
        }
      </ul>
    )
  }
}

export default AppSidebarPortfolioList