/**
 * Notifications locales ou envoyées à un autre utilisateur par socket.
 */

import { SOCKET_NAME } from "./constants.js";

export function sendNotification(targetId, level, message) {
  game.socket.emit(SOCKET_NAME, {
    type: "notification",
    targetId,
    level,
    message
  });
}

export function notifyRequester(requesterId, level, message) {
  if (requesterId === game.user.id) {
    ui.notifications[level]?.(message);
    return;
  }

  sendNotification(requesterId, level, message);
}
