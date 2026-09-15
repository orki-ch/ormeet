import App from './App.js'
import router from './router.js'
import { wachsen } from './utils/wachsen.js'

Vue.createApp(App).use(router).directive('wachsen', wachsen).mount('#app')
