/** Plain-language reason a message did not go out (ChatMessage.failReason). */
export function failReasonText(reason?: string): string {
  switch (reason) {
    case 'recipient_offline':
      return "They aren't online right now. Messages are only delivered while both of you are connected.";
    case 'not_connected':
      return 'You are not connected to the server. Check your connection and try again.';
    case 'connection_lost':
      return 'The connection dropped while sending. The message may not have been delivered.';
    case 'ack_timeout':
      return 'The server did not confirm in time. The message may not have been delivered.';
    case 'interrupted':
      return 'The app closed before this message was confirmed.';
    case 'no_key':
      return "Could not encrypt this message because their security key isn't available yet.";
    case 'local_key_error':
      return "Could not access this phone's security key.";
    case 'not_contact':
      return "You can only message approved contacts.";
    case 'rate_limited':
      return 'You are sending too fast. Wait a moment and try again.';
    default:
      return 'The message could not be sent.';
  }
}
