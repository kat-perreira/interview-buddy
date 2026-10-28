// Limits the client and server both enforce. Values come from docs/spec.md (Limits).

// Candidate messages longer than this are rejected before any model call.
export const MAX_MESSAGE_CHARS = 2000;

// The one counting rule for message length, so the client counter and the server agree.
// Counts characters (code points), so an emoji counts once, not as two UTF-16 units.
export function messageLength(message: string): number {
  return [...message].length;
}
