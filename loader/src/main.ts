import { createApp } from 'vue'
import App from './App.vue'
import { createLoaderI18n } from '@riot/i18n'
import './App.css'
import 'tippy.js/dist/tippy.css'

declare const __VERSION__: string

// @ts-ignore
window.appVersion = __VERSION__
// @ts-ignore
window.isMac = false

const i18n = createLoaderI18n()

createApp(App).use(i18n).mount('#root')
