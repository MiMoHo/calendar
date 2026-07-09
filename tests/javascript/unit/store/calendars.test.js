/**
 * SPDX-FileCopyrightText: 2019 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import useCalendarsStore from '../../../../src/store/calendars.js'

import { setActivePinia, createPinia } from 'pinia'

describe('store/calendars test suite', () => {
	
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	it('should provide a getter for all writable calendars sorted', () => {
		const calendarsStore = useCalendarsStore()
		const calendarOrderLast = {
			id: "1",
			order: 2,
			supportsEvents: false,
			supportsJournals: true
		}
		const calendarReadOnly = {
			id: "2",
			readOnly: true,
			supportsEvents: true,
		}
		const calendarOrderFirst = {
			id: "3",
			order: 1,
			supportsEvents: true,
			supportsJournals: false
		}
		calendarsStore.addCalendarMutation({ calendar: calendarOrderLast })
		calendarsStore.addCalendarMutation({ calendar: calendarReadOnly })
		calendarsStore.addCalendarMutation({ calendar: calendarOrderFirst })

		writableCalendars = calendarsStore.sortedWritableCalendarsEvenWithoutSupportForEvents
		expect(writableCalendars).toMatchObject([calendarOrderFirst, calendarOrderLast])
	})

	const makeIcs = (uid, transp) => [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Test//Test//EN',
		'BEGIN:VEVENT',
		`UID:${uid}`,
		'DTSTAMP:20260701T000000Z',
		'DTSTART:20260710T100000Z',
		'DTEND:20260710T110000Z',
		...(transp ? [`TRANSP:${transp}`] : []),
		'END:VEVENT',
		'END:VCALENDAR',
		'',
	].join('\r\n')

	it('should align the transparency of existing events with the calendar', async () => {
		const calendarsStore = useCalendarsStore()
		calendarsStore.addCalendarMutation({ calendar: { id: 'cal-1' } })

		const davBusy = { url: '/cal-1/busy.ics', data: makeIcs('busy', null), update: vi.fn().mockResolvedValue(undefined) }
		const davMatching = { url: '/cal-1/free.ics', data: makeIcs('free', 'TRANSPARENT'), update: vi.fn() }
		const davBroken = { url: '/cal-1/broken.ics', data: '', update: vi.fn() }
		const calendar = {
			id: 'cal-1',
			dav: { findByType: vi.fn().mockResolvedValue([davBusy, davMatching, davBroken]) },
		}

		const result = await calendarsStore.alignCalendarEventsTransparency({ calendar, transparency: 'TRANSPARENT' })

		expect(calendar.dav.findByType).toHaveBeenCalledWith('VEVENT')
		expect(result).toEqual({ updated: 1, failed: 1 })
		expect(davBusy.update).toHaveBeenCalledTimes(1)
		expect(davBusy.data).toContain('TRANSP:TRANSPARENT')
		expect(davMatching.update).not.toHaveBeenCalled()
	})

	it('should treat events without TRANSP as busy when aligning', async () => {
		const calendarsStore = useCalendarsStore()
		calendarsStore.addCalendarMutation({ calendar: { id: 'cal-1' } })

		const davDefault = { url: '/cal-1/default.ics', data: makeIcs('default', null), update: vi.fn() }
		const davFree = { url: '/cal-1/free.ics', data: makeIcs('free', 'TRANSPARENT'), update: vi.fn().mockResolvedValue(undefined) }
		const calendar = {
			id: 'cal-1',
			dav: { findByType: vi.fn().mockResolvedValue([davDefault, davFree]) },
		}

		const result = await calendarsStore.alignCalendarEventsTransparency({ calendar, transparency: 'OPAQUE' })

		expect(result).toEqual({ updated: 1, failed: 0 })
		// TRANSP defaults to OPAQUE, so the event without it needs no update
		expect(davDefault.update).not.toHaveBeenCalled()
		expect(davFree.update).toHaveBeenCalledTimes(1)
		expect(davFree.data).toContain('TRANSP:OPAQUE')
	})

})
