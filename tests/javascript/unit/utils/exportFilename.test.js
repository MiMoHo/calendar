/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { calendarExportFilename } from '../../../../src/utils/exportFilename'

describe('utils/exportFilename test suite', () => {
	const cal = (url, displayName) => ({ url, displayName })

	it('should name the file after the calendar', () => {
		const termine = cal('/calendars/user/termine/', 'Termine')
		expect(calendarExportFilename(termine, [termine]))
			.toEqual('termine.ics')
	})

	it('should number calendars sharing a name in creation order', () => {
		const first = cal('/calendars/user/termine/', 'Termine')
		const second = cal('/calendars/user/termine-1/', 'Termine')
		const all = [second, first]

		expect(calendarExportFilename(first, all)).toEqual('termine.ics')
		expect(calendarExportFilename(second, all)).toEqual('termine2.ics')
	})

	it('should move the plain name up once the older calendar is gone', () => {
		const second = cal('/calendars/user/termine-1/', 'Termine')

		expect(calendarExportFilename(second, [second]))
			.toEqual('termine.ics')
	})

	it('should not confuse calendars with different names', () => {
		const termine = cal('/calendars/user/termine/', 'Termine')
		const arbeit = cal('/calendars/user/arbeit/', 'Arbeit')

		expect(calendarExportFilename(termine, [termine, arbeit]))
			.toEqual('termine.ics')
		expect(calendarExportFilename(arbeit, [termine, arbeit]))
			.toEqual('arbeit.ics')
	})

	it('should replace characters file systems reject', () => {
		const weird = cal('/calendars/user/foo/', ' Ter/mine: 2026? ')
		expect(calendarExportFilename(weird, [weird]))
			.toEqual('ter-mine- 2026-.ics')
	})

	it('should fall back for empty names', () => {
		const unnamed = cal('/calendars/user/x/', '   ')
		expect(calendarExportFilename(unnamed, [unnamed]))
			.toEqual('calendar.ics')
	})
})
