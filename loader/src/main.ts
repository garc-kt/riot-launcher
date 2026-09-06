import { createApp } from 'vue'
import App from './App.vue'
import './App.css'
import 'tippy.js/dist/tippy.css'

declare const __VERSION__: string

// @ts-ignore
window.appVersion = __VERSION__
// @ts-ignore
window.isMac = false

createApp(App).mount('#root')
