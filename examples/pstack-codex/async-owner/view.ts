export const title = "Cancellation and an outstanding acknowledgement";
export const state = (v: Record<string, unknown>) =>
  `${v.phase}${v.pending === -1 ? "" : " — ACK pending"}`;
export const step = (action: string) => ({
  Queue: "start asynchronous work",
  Cancel: "cancel the owner",
  ReceiveAck: "receive the acknowledgement",
  Done: "remain finished",
}[action] ?? action);
