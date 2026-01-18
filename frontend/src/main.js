import { createApp } from 'vue'
import App from '@/App.vue'
import { registerPlugins } from '@core/utils/plugins'
import moment from 'moment'

// Make moment available globally for daterangepicker
if (typeof window !== 'undefined') {
  window.moment = moment
}

// Styles
import '@core/scss/template/index.scss'
import '@styles/styles.scss'
import 'daterangepicker/daterangepicker.css'

// Create vue app
const app = createApp(App)


// Register plugins
registerPlugins(app)

// Mount vue app
app.mount('#app')
