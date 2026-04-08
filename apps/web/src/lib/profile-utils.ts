/**
 * Get initials: first letter of first name + first letter of last name.
 * e.g. "Nir Timor" -> "NT", "David" -> "DA"
 */
export function getInitials(displayName: string): string {
    const trimmed = (displayName || '').trim();
    if (!trimmed) return '';
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        const first = parts[0].charAt(0);
        const last = parts[parts.length - 1].charAt(0);
        return (first + last).toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
}
