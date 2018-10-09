
export function positionUpdated(entry, changed) {
  return {type: "POSITION_UPDATE", payload: {entry: entry, changed: changed}};
}

export function statusUpdated(status, msgId) {
  return {type: "STATUS_UPDATE", payload: {status: status, msgId: msgId}};
}

export function newMessage(msg) {
  return {type: "NEW_MESSAGE", payload: msg}
}

