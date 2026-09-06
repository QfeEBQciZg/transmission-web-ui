import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './styles/index.scss'
import App from './App.vue'
import { i18n } from './i18n'
import { useUiStore } from './stores/ui'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(i18n)
app.use(ElementPlus)

// Keep the vue-i18n locale in sync with the persisted UI preference.
const ui = useUiStore(pinia)
i18n.global.locale.value = ui.locale
watch(
  () => ui.locale,
  (locale) => {
    i18n.global.locale.value = locale
  },
)

app.mount('#app')
