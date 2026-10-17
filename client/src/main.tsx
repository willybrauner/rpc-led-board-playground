import "./index.css"
import css from "./main.module.css"
import { render } from "preact"
import { WS_PORT, type ServerMessage, type TTurnOff, type TTurnOn } from "common"
import { signal } from "@preact/signals"

// ------------------------------------------------------ RPC

/**
 * Create RPC
 * @param url
 */
const createRPC = (url = `ws://localhost:${WS_PORT}`) => {
  const ws = new WebSocket(url)
  const listeners = new Map<string, Set<(p: any) => void>>()
  const pending = new Map<
    string,
    { method: string; resolve: (v: any) => void; reject: (e: any) => void }
  >()
  const generateId = () => Math.random().toString(36).substring(2, 15)

  const rawSend = (msg: object) => {
    const payload = JSON.stringify(msg)
    if (ws.readyState === WebSocket.OPEN) ws.send(payload)
  }

  ws.addEventListener("open", () => {
    console.log("WS connected")
  })

  ws.addEventListener("close", () => {
    pending.forEach((p) => p.reject(new Error("disconnected")))
    pending.clear()
  })

  ws.addEventListener("message", (e) => {
    const msg: ServerMessage = JSON.parse(e.data)
    if (msg.type === "event") {
      console.log(`%c← ${msg.event}`, "color: violet", msg.payload)
      listeners.get(msg.event)?.forEach((cb) => cb(msg.payload))
      return
    }

    // remove the pending promise and resolve it
    const pend = pending.get(msg.id)
    if (!pend) {
      console.log("no pending for", msg.id, "return.")
      return
    }
    pending.delete(msg.id)
    if (msg.type === "result") {
      console.log(`%c← ${pend.method} result`, "color: green")
      pend.resolve(msg.result)
    } else {
      console.log(`%c← ${pend.method} error`, "color: red", msg.error.message)
      pend.reject(new Error(msg.error.message))
    }
  })

  return {
    call: (method: string, params: unknown[]) => {
      // a call is a "promise" that will be resolved when the server responds
      return new Promise((resolve, reject) => {
        const id = generateId()
        pending.set(id, { method, resolve, reject })
        console.log(`%c→ ${method}`, "color: orange", ...params)
        rawSend({ type: "call", id, method, params })
      })
    },
    on: (event: string, cb: (p: any) => void) => {
      // the pub-sub pattern
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(cb)
    },
  }
}

// ------------------------------------------------------ MODEL

/**
 * Model
 */
const ledsModel = (rpc: ReturnType<typeof createRPC>) => {
  const leds = signal<[string, string][]>([])
  // The signal is updated each time the server sends a new state
  rpc.on("leds", (value) => (leds.value = value))
  return {
    leds,
    turnOn: (...params: TTurnOn) => rpc.call("turnOn", params),
    turnOff: (...params: TTurnOff) => rpc.call("turnOff", params),
    clear: () => rpc.call("clear", []),
  }
}

// ------------------------------------------------------ HELPER

const getRandomRGB = () => {
  const randomRGB = () => Math.floor(Math.random() * 256)
  return `rgb(${randomRGB()}, ${randomRGB()}, ${randomRGB()})`
}

// ------------------------------------------------------ APP

const GRID = 32

const rpc = createRPC()
const board = ledsModel(rpc)

/**
 * The App component
 */
export function App() {
  // Turn on a random LED with a random color
  const turnOnRandomLed = () => {
    const randomCoords = () => Math.floor(Math.random() * GRID)
    const x = randomCoords()
    const y = randomCoords()
    board.turnOn(x, y, getRandomRGB())
  }

  // Clear random Leds
  const clear = () => board.clear()

  return (
    <div class={css.root}>
      <div class={css.controls}>
        <button onClick={turnOnRandomLed}>Turn On a random LED</button>{" "}
        <button onClick={clear}>Clear</button>
      </div>
      <div class={css.grid} style={{ "--grid": GRID }}>
        {Array.from({ length: GRID * GRID }, (_, i) => {
          const x = i % GRID
          const y = Math.floor(i / GRID)
          return (
            <div
              onClick={() => board.turnOn(x, y, getRandomRGB())}
              key={i}
              class={css.led}
              style={{
                background: board.leds.value.find(([key]) => key === `${x}:${y}`)?.[1],
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

render(<App />, document.getElementById("app")!)
