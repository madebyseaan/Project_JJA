/**
 * Staff names are stored in the database. “You” is only a UI label for the
 * signed-in person, so reports and future exports keep the real name.
 */
export function staffLabel(
  person: { id: string; displayName: string },
  currentUserId: string | null | undefined,
): string {
  return person.id === currentUserId ? 'You' : person.displayName;
}
