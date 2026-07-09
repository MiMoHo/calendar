/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { getCanonicalLocale, translate as t } from '@nextcloud/l10n'
// @ts-expect-error - not migrated to typescript yet
import { formatDateWithTimezone, getLastCoveredDay } from '../../utils/date.js'

const DAY_MS = 24 * 60 * 60 * 1000

interface EventContentArg {
	event: {
		allDay: boolean
		start: Date | null
		end: Date | null
		title: string
		extendedProps: {
			realStart?: Date
			realEnd?: Date
			description?: string
		}
	}
	isStart: boolean
	isEnd: boolean
	view: {
		type: string
		currentStart: Date
	}
}

interface EventContentResult {
	domNodes: Node[]
}

// Returning true tells fullcalendar to render its default content
type EventContent = EventContentResult | true

/**
 * Builds the day-part suffix shown in the day view.
 *
 * The day view only ever shows one day of an event, so multi-day events
 * are marked as partial: all-day events as well as split multi-day
 * events (which carry their real times in realStart/realEnd) are
 * labelled with the rendered day's position, e.g. " (Day 2/6)". Timed
 * events crossing a single midnight carry no label: their date-prefixed
 * time labels already name the other day.
 *
 * @param arg The fullcalendar content arg
 * @return The suffix including its leading space, empty for single-day events
 */
function dayPartSuffix(arg: EventContentArg): string {
	if (arg.view.type !== 'timeGridDay' || !arg.view.currentStart) {
		return ''
	}

	const start = arg.event.extendedProps.realStart ?? arg.event.start
	const end = arg.event.extendedProps.realEnd ?? arg.event.end
	if (!start || !end) {
		return ''
	}

	const firstDay = new Date(start)
	firstDay.setHours(0, 0, 0, 0)
	// Rounding absorbs the shifted millisecond differences around DST changes
	const total = Math.round((getLastCoveredDay(end).getTime() - firstDay.getTime()) / DAY_MS) + 1
	if (total < 2) {
		return ''
	}

	const renderedDay = new Date(arg.view.currentStart)
	renderedDay.setHours(0, 0, 0, 0)
	const current = Math.min(total, Math.max(1, Math.round((renderedDay.getTime() - firstDay.getTime()) / DAY_MS) + 1))

	if (!arg.event.allDay && total === 2) {
		return ''
	}

	return ' ' + t('calendar', '(Day {current}/{total})', { current, total })
}

/**
 * Renders the inner content of timed events in the week and day grids.
 *
 * fullcalendar labels each rendered day segment with the segment's time
 * range, so an event running from 18:00 into the next morning reads
 * "18:00 - 00:00" on its first day. Instead, always show the event's real
 * start and end time. Times lying on another day than the rendered segment
 * are prefixed with their date: the first day of a two-day event reads
 * "22:00 - 26.7. 12:00", its second day "25.7. 22:00 - 12:00".
 * Split multi-day events carry their real times in realStart/realEnd.
 *
 * The description follows below the title in smaller letters. Both may
 * flow into the free slots below the event until the next event blocks
 * them (see the overflow and background rules in the CSS).
 *
 * In the day view, events covering more than the rendered day carry a
 * day-part suffix in their title (see dayPartSuffix). This includes the
 * events in the all-day row, which otherwise keep fullcalendar's default
 * rendering, replicated here with the suffix attached.
 *
 * All other views keep fullcalendar's default rendering.
 *
 * @param arg The fullcalendar content arg
 * @return Custom content for timed week/day grid events, the default otherwise
 */
export default function eventContent(arg: EventContentArg): EventContent {
	if (!arg.view.type.startsWith('timeGrid')) {
		return true
	}

	if (arg.event.allDay) {
		const suffix = dayPartSuffix(arg)
		if (!suffix) {
			return true
		}

		const frame = document.createElement('div')
		frame.classList.add('fc-event-main-frame')
		const titleContainer = document.createElement('div')
		titleContainer.classList.add('fc-event-title-container')
		const title = document.createElement('div')
		title.classList.add('fc-event-title', 'fc-sticky')
		title.textContent = arg.event.title + suffix
		titleContainer.appendChild(title)
		frame.appendChild(titleContainer)

		return { domNodes: [frame] }
	}

	const start = arg.event.extendedProps.realStart ?? arg.event.start
	const end = arg.event.extendedProps.realEnd ?? arg.event.end
	if (!start || !end) {
		return true
	}

	const locale = getCanonicalLocale() || undefined
	const timeOptions = { hour: '2-digit', minute: '2-digit' }
	const dayOptions = { day: 'numeric', month: 'numeric' }
	const startTime = formatDateWithTimezone(start, locale, timeOptions, true)
	const endTime = formatDateWithTimezone(end, locale, timeOptions, true)
	const startDay = formatDateWithTimezone(start, locale, dayOptions, true)
	const endDay = formatDateWithTimezone(end, locale, dayOptions, true)

	// The day this segment renders on: segments containing the (part's)
	// start begin on its start day, trailing segments end on its end day
	const renderedDayAnchor = arg.isStart ? arg.event.start : (arg.isEnd ? arg.event.end : null)
	const renderedDay = renderedDayAnchor
		? formatDateWithTimezone(renderedDayAnchor, locale, dayOptions, true)
		: null

	const startLabel = renderedDay && startDay !== renderedDay ? `${startDay} ${startTime}` : startTime
	const endLabel = renderedDay && endDay !== renderedDay ? `${endDay} ${endTime}` : endTime
	const timeText = `${startLabel} - ${endLabel}`

	const frame = document.createElement('div')
	frame.classList.add('fc-event-main-frame')

	const time = document.createElement('div')
	time.classList.add('fc-event-time')
	time.textContent = timeText
	frame.appendChild(time)

	const titleContainer = document.createElement('div')
	titleContainer.classList.add('fc-event-title-container')
	const title = document.createElement('div')
	title.classList.add('fc-event-title', 'fc-sticky')
	title.textContent = arg.event.title + dayPartSuffix(arg)
	titleContainer.appendChild(title)
	frame.appendChild(titleContainer)

	if (arg.event.extendedProps.description) {
		const description = document.createElement('div')
		description.classList.add('fc-event-nc-description')
		description.textContent = arg.event.extendedProps.description
		frame.appendChild(description)
	}

	return { domNodes: [frame] }
}
