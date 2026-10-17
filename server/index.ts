import { WS_PORT, type ClientMessage, type ServerMessage } from "common"
import { WebSocketServer, WebSocket, type RawData } from "ws"
import { styleText } from "node:util"

// ----------------------------------------------------- LOGS

// each socket gets a short name, to follow it in the logs
const names = new WeakMap<WebSocket, string>()
let clientCount = 0
const nameOf = (ws: WebSocket) => styleText("cyan", names.get(ws) ?? "?")

// keep the payloads readable on one line
const short = (value: unknown) =>
  Array.isArray(value) ? `(${value.length} items)` : (JSON.stringify(value) ?? "")

// ----------------------------------------------------- STATE

const leds = new Map<string, string>()

// ----------------------------------------------------- METHODS

// Publish an event's payload to all the clients
const publish = (event: string, payload: unknown): void => {
  console.log(styleText("magenta", `⇉ publish ${event} to ${wss.clients.size} client(s)`))
  wss.clients.forEach((client) => send(client, { type: "event", event, payload }))
}


/**
 * Registry!
 */
const registry = {
  turnOn: (x: number, y: number, color: string) => {
    leds.set(`${x}:${y}`, color)
    publish("leds", [...leds])
  },
  turnOff: (x: number, y: number) => {
    leds.delete(`${x}:${y}`)
    publish("leds", [...leds])
  },
  clear: () => {
    leds.clear()
    publish("leds", [])
  },
}
type Registry = typeof registry

// Send to a specific client
const send = (ws: WebSocket, msg: ServerMessage): void => {
  // results are not logged, the state already goes through publish
  if (msg.type === "event") {
    console.log(`  → ${nameOf(ws)} ${styleText("magenta", `${msg.event} ${short(msg.payload)}`)}`)
  } else if (msg.type === "error") {
    console.log(`  → ${nameOf(ws)} ${styleText("red", `error ${msg.error.message}`)}`)
  }
  ws.send(JSON.stringify(msg))
}

// -------------------------------------- WS

const wss = new WebSocketServer({ port: parseInt(WS_PORT) })
console.log(styleText("green", `RPC server listening on ws://localhost:${WS_PORT}`))

wss.on("connection", (ws) => {
  names.set(ws, `client#${++clientCount}`)
  console.log(`\n${styleText("green", "+")} ${nameOf(ws)} connected`)

  // A new client gets the current state right away
  send(ws, { type: "event", event: "leds", payload: [...leds] })

  // listen message coming from the client
  ws.on("message", async (raw: RawData) => {
    let msg: ClientMessage = JSON.parse(String(raw))
    const args = msg.params.map((p) => JSON.stringify(p)).join(", ")
    console.log(`\n← ${nameOf(ws)} ${styleText("yellow", `${msg.method}(${args})`)}`)

    const fn = registry[msg.method as keyof Registry] as
      | ((...args: unknown[]) => unknown)
      | undefined

    // test the promise
    // await new Promise(r => setTimeout(r, 1000))

    if (!fn) {
      return send(ws, {
        type: "error",
        id: msg.id,
        error: { code: "METHOD_NOT_FOUND", message: `Unknown method: ${msg.method}` },
      })
    }

    // execute the selected function
    try {
      const result = await fn(...msg.params)
      send(ws, { type: "result", id: msg.id, result })
    } catch (e) {
      send(ws, { type: "error", id: msg.id, error: { message: (e as Error).message } })
    }
  })

  // a client is gone
  ws.on("close", () => {
    console.log(`\n${styleText("red", "-")} ${nameOf(ws)} disconnected`)
  })
})
