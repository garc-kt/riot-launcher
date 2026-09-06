/* @refresh reload */
import { render } from 'solid-js/web'

import App from './App'

// @ts-ignore
window.appVersion = __VERSION__
// @ts-ignore
window.isMac = false

render(() => <App />, document.getElementById('root') as HTMLElement)