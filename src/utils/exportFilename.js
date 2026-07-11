/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * The calendar name reduced to a safe file name: trimmed, lowercased and
 * with characters that file systems reject replaced by dashes
 *
 * @param {string} displayName The calendar's display name
 * @return {string}
 */
function normalizeCalendarName(displayName) {
	const name = (displayName || '').trim().toLowerCase()
		.replace(/[\\/:*?"<>|]/g, '-')
		.replace(/\s+/g, ' ')

	return name || 'calendar'
}

/**
 * File name for a calendar export, derived from the calendar's current
 * display name. Calendars sharing a name get an appended counter in
 * creation order ("termine.ics", "termine2.ics", ...). The name is
 * computed freshly on every download, so it heals itself: once the first
 * "Termine" calendar is deleted, the remaining one exports as
 * "termine.ics" again without any rename in the user interface.
 *
 * @param {object} calendar The calendar to export
 * @param {object[]} calendars All calendars of the user
 * @return {string} The file name including the .ics extension
 */
export function calendarExportFilename(calendar, calendars) {
	const name = normalizeCalendarName(calendar.displayName)

	// Creation order is not exposed over CalDAV; the URI is derived from
	// the name at creation time and suffixed for later duplicates, so the
	// shorter (unsuffixed, older) URI sorts first
	const twins = calendars
		.filter((other) => normalizeCalendarName(other.displayName) === name)
		.sort((a, b) => ((a.url || '').length - (b.url || '').length)
			|| (a.url || '').localeCompare(b.url || ''))

	const index = twins.findIndex((other) => other.url === calendar.url)
	if (index <= 0) {
		return `${name}.ics`
	}

	return `${name}${index + 1}.ics`
}
