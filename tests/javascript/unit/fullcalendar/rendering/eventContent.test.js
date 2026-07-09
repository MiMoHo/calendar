/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { getCanonicalLocale, translate } from '@nextcloud/l10n'
import eventContent from '../../../../../src/fullcalendar/rendering/eventContent.ts'

vi.mock('@nextcloud/l10n')

vi.mock('../../../../../src/utils/date.js', async (importOriginal) => {
	const actual = await importOriginal()
	return {
		...actual,
		// The real implementation converts to the user's timezone via the
		// settings store; format deterministically instead
		formatDateWithTimezone: vi.fn((date, locale, options) => {
			if (options.hour) {
				return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
			}
			return `${date.getDate()}.${date.getMonth() + 1}.`
		}),
	}
})

describe('fullcalendar/rendering/eventContent test suite', () => {
	beforeEach(() => {
		getCanonicalLocale.mockReturnValue('en')
		translate.mockImplementation((app, str, params) => str.replace(/{(\w+)}/g, (_, key) => params?.[key] ?? ''))
	})

	const makeArg = ({ viewType = 'timeGridDay', currentStart, allDay = false, start, end, title = 'Test', extendedProps = {}, isStart = true, isEnd = true }) => ({
		event: { allDay, start, end, title, extendedProps },
		isStart,
		isEnd,
		view: { type: viewType, currentStart },
	})

	const titleOf = (result) => result.domNodes[0].querySelector('.fc-event-title').textContent
	const timeOf = (result) => result.domNodes[0].querySelector('.fc-event-time').textContent

	it('should keep the default rendering outside the time grids', () => {
		const arg = makeArg({
			viewType: 'dayGridMonth',
			currentStart: new Date(2026, 6, 1),
			start: new Date(2026, 6, 10, 21, 0),
			end: new Date(2026, 6, 11, 6, 0),
		})
		expect(eventContent(arg)).toBe(true)
	})

	it('should show the real start and end time with day prefixes for other days', () => {
		const start = new Date(2026, 6, 10, 21, 0)
		const end = new Date(2026, 6, 11, 6, 0)
		const firstDay = eventContent(makeArg({
			viewType: 'timeGridWeek', currentStart: new Date(2026, 6, 6), start, end, isStart: true, isEnd: false,
		}))
		expect(timeOf(firstDay)).toEqual('21:00 - 11.7. 06:00')
		const secondDay = eventContent(makeArg({
			viewType: 'timeGridWeek', currentStart: new Date(2026, 6, 6), start, end, isStart: false, isEnd: true,
		}))
		expect(timeOf(secondDay)).toEqual('10.7. 21:00 - 06:00')
	})

	it('should render the description below the title', () => {
		const result = eventContent(makeArg({
			viewType: 'timeGridWeek',
			currentStart: new Date(2026, 6, 6),
			start: new Date(2026, 6, 7, 13, 0),
			end: new Date(2026, 6, 7, 13, 30),
			extendedProps: { description: 'Bring notes' },
		}))
		expect(result.domNodes[0].querySelector('.fc-event-nc-description').textContent).toEqual('Bring notes')
	})

	it('should not suffix single-day events in the day view', () => {
		const result = eventContent(makeArg({
			currentStart: new Date(2026, 6, 7),
			start: new Date(2026, 6, 7, 13, 0),
			end: new Date(2026, 6, 7, 13, 30),
			title: 'Kurzbesprechung',
		}))
		expect(titleOf(result)).toEqual('Kurzbesprechung')
	})

	it('should not suffix events in the week grid', () => {
		const result = eventContent(makeArg({
			viewType: 'timeGridWeek',
			currentStart: new Date(2026, 6, 6),
			start: new Date(2026, 6, 10, 21, 0),
			end: new Date(2026, 6, 11, 6, 0),
			title: 'Nachtschicht',
			isEnd: false,
		}))
		expect(titleOf(result)).toEqual('Nachtschicht')
	})

	it('should not suffix timed events crossing a single midnight', () => {
		// Their date-prefixed time labels already name the other day
		const start = new Date(2026, 6, 10, 21, 0)
		const end = new Date(2026, 6, 11, 6, 0)
		const firstDay = eventContent(makeArg({
			currentStart: new Date(2026, 6, 10), start, end, title: 'Nachtschicht', isStart: true, isEnd: false,
		}))
		expect(titleOf(firstDay)).toEqual('Nachtschicht')
		expect(timeOf(firstDay)).toEqual('21:00 - 11.7. 06:00')
		const secondDay = eventContent(makeArg({
			currentStart: new Date(2026, 6, 11), start, end, title: 'Nachtschicht', isStart: false, isEnd: true,
		}))
		expect(titleOf(secondDay)).toEqual('Nachtschicht')
		expect(timeOf(secondDay)).toEqual('10.7. 21:00 - 06:00')
	})

	it('should not count a midnight end as an additional day', () => {
		const result = eventContent(makeArg({
			currentStart: new Date(2026, 6, 7),
			start: new Date(2026, 6, 7, 20, 0),
			end: new Date(2026, 6, 8, 0, 0),
			title: 'Abendtermin',
		}))
		expect(titleOf(result)).toEqual('Abendtermin')
	})

	it('should label the timed parts of split multi-day events with their day position', () => {
		const realStart = new Date(2026, 6, 16, 20, 0)
		const realEnd = new Date(2026, 6, 21, 12, 0)
		const startPart = eventContent(makeArg({
			currentStart: new Date(2026, 6, 16),
			start: realStart,
			end: new Date(2026, 6, 17, 0, 0),
			title: 'Segeltoern',
			extendedProps: { realStart, realEnd },
		}))
		expect(titleOf(startPart)).toEqual('Segeltoern (Day 1/6)')
		expect(timeOf(startPart)).toEqual('20:00 - 21.7. 12:00')
		const endPart = eventContent(makeArg({
			currentStart: new Date(2026, 6, 21),
			start: new Date(2026, 6, 21, 0, 0),
			end: realEnd,
			title: 'Segeltoern',
			extendedProps: { realStart, realEnd },
		}))
		expect(titleOf(endPart)).toEqual('Segeltoern (Day 6/6)')
	})

	it('should label the all-day bridge of split multi-day events with the rendered day', () => {
		const realStart = new Date(2026, 6, 16, 20, 0)
		const realEnd = new Date(2026, 6, 21, 12, 0)
		const bridge = eventContent(makeArg({
			currentStart: new Date(2026, 6, 17),
			allDay: true,
			start: new Date(2026, 6, 17),
			end: new Date(2026, 6, 21),
			title: 'Segeltoern',
			extendedProps: { realStart, realEnd },
		}))
		expect(titleOf(bridge)).toEqual('Segeltoern (Day 2/6)')
		expect(bridge.domNodes[0].querySelector('.fc-event-time')).toBeNull()
	})

	it('should label multi-day all-day events with the rendered day', () => {
		const result = eventContent(makeArg({
			currentStart: new Date(2026, 6, 14),
			allDay: true,
			start: new Date(2026, 6, 13),
			// fullcalendar's all-day end is exclusive: covers 13.7. - 17.7.
			end: new Date(2026, 6, 18),
			title: 'Urlaub',
		}))
		expect(titleOf(result)).toEqual('Urlaub (Day 2/5)')
	})

	it('should keep the default rendering for single-day all-day events', () => {
		const result = eventContent(makeArg({
			currentStart: new Date(2026, 6, 8),
			allDay: true,
			start: new Date(2026, 6, 8),
			end: new Date(2026, 6, 9),
			title: 'Feiertag',
		}))
		expect(result).toBe(true)
	})
})
