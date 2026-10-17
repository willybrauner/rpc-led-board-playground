export const WS_PORT = "8080"

export type RPCCall = {
  type: "call"
  id: string
  method: string
  params: unknown[]
}
export type RPCResult = {
  type: "result"
  id: string
  result: unknown
}
export type RPCError = {
  type: "error"
  id: string
  error: { code?: string; message: string }
}

// push, without id
export type RPCEvent = {
  type: "event"
  event: string
  payload: unknown
}

export type ClientMessage = RPCCall
export type ServerMessage = RPCResult | RPCError | RPCEvent



export type TTurnOn = [number, number, string]
export type TTurnOff = [number, number]