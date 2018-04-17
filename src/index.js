import React from 'react'
import { render } from 'react-dom'

// Import styles
import 'material-design-icons/iconfont/material-icons.css'
import 'typeface-roboto'
import './assets/fonts/segmdl2-webfont.woff2'

// Import application
import App from './components/App'

// Generate application element
let el = null

el = document.createElement('div')
el.id = "app"
document.body.appendChild(el)

// Now we can render our application into it
window.App = render(<App />, document.getElementById(el.id))
