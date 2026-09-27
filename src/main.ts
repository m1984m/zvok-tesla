import { mount } from 'svelte'
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
