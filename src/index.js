import React from 'react'
import { render } from 'react-dom'
import 'typeface-roboto'

// Import application
import App from './components/App'

// Generate application element
let el = null

el = document.createElement('div')
el.id = "app"
document.body.appendChild(el)

// Now we can render our application into it
window.App = render(<App />, document.getElementById(el.id))
