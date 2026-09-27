import { mount } from 'svelte'
import '@fontsource/barlow-condensed/latin-ext-500.css'
import '@fontsource/barlow-condensed/latin-ext-600.css'
import '@fontsource/barlow-condensed/latin-ext-700.css'
import '@fontsource/barlow-condensed/latin-500.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import './app.css'
import App from './App.svelte'
import { car } from './lib/state.svelte'
import { audio } from './lib/audio/context'

declare const __BUILD__: string

const app = mount(App, {
  target: document.getElementById('app')!,
})

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register(`./sw.js?v=${__BUILD__}`)
}

// za preverjanje (scripts/check-app.mjs); osebna aplikacija, brez skrivnosti
Object.assign(window, { __pogon: { car, audio } })

export default app
