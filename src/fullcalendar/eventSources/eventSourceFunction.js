/**
 * SPDX-FileCopyrightText: 2019 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { translate as t } from '@nextcloud/l10n'
import useCalendarObjectsStore from '../../store/calendarObjects.js'
import usePrincipalsStore from '../../store/principals.js'
import useSettingsStore from '../../store/settings.js'
import useTasksStore from '../../store/unscheduledTasks.js'
import { getAllObjectsInTimeRange } from '../../utils/calendarObject.js'
import {
	getHexForColorName,
	hexToRGB,
	isLight,
	lightenColorForPastEvents,
} from '../../utils/color.js'
import { getLastCoveredDay } from '../../utils/date.js'
import logger from '../../utils/logger.js'

// The quantized duration classes cover up to a week (see fullcalendar.scss)
const DURATION_CLASS_MAX_HOURS = 7 * 24

/**
 * convert an array of calendar-objects to events
 *
 * @param {CalendarObject[]} calendarObjects Array of calendar-objects to turn into fc events
 * @param {object} calendar The calendar object
 * @param {Date} start Start of time-range
 * @param {Date} end End of time-range
 * @param {Timezone} timezone Desired time-zone
 * @param {string|null} viewType The fullcalendar view the events are rendered in
 * @return {object}[]
 */
export function eventSourceFunction(calendarObjects, calendar, start, end, timezone, viewType = null) {
	const principalsStore = usePrincipalsStore()
	const tasksStore = useTasksStore()
	const settingsStore = useSettingsStore()
	tasksStore.emptyCalendar(calendar.id)

	const searchTerms = settingsStore.searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)

	// Read-only calendars (e.g. webcal subscriptions) can carry a display
	// override for the busy status of their events: their events cannot be
	// edited (the next sync would revert them), so the override replaces
	// the per-event TRANSP delivered by the source
	const transparencyOverride = settingsStore.subscriptionTransparencyOverrides?.[calendar.id] ?? null

	// The week/day grids let title and description flow into the free slots
	// below an event. How far they may flow travels as a quantized class:
	// the number of display slots between the event's end and the next
	// timed event, so the text always stops one line short of it (see the
	// fc-event-nc-flow-* rules in the CSS). Slots follow the user's slot
	// duration, matching fullcalendar's em-based slot height. Events of
	// OTHER calendars count too, from the already fetched objects: sources
	// resolve one calendar at a time, so the earliest render of a view may
	// briefly miss a neighbour, corrected with the next refetch.
	const slotMinutes = (() => {
		const parts = (settingsStore.slotDuration || '00:30:00').split(':').map(Number)
		return Math.max(5, (parts[0] || 0) * 60 + (parts[1] || 0))
	})()
	const timedIntervals = []
	const objectsInRange = new Map()
	for (const calendarObject of calendarObjects) {
		try {
			const objects = getAllObjectsInTimeRange(calendarObject, start, end)
			objectsInRange.set(calendarObject, objects)
			for (const object of objects) {
				if (object.name === 'VEVENT' && !object.isAllDay() && object.startDate) {
					timedIntervals.push({
						start: object.startDate.getInTimezone(timezone).jsDate.getTime(),
						end: object.endDate ? object.endDate.getInTimezone(timezone).jsDate.getTime() : null,
					})
				}
			}
		} catch (error) {
			logger.error(error.message)
		}
	}
	const calendarObjectsStore = useCalendarObjectsStore()
	for (const otherObject of Object.values(calendarObjectsStore.calendarObjects)) {
		if (otherObject.calendarId === calendar.id || !otherObject.isEvent) {
			continue
		}
		try {
			for (const object of getAllObjectsInTimeRange(otherObject, start, end)) {
				if (object.name === 'VEVENT' && !object.isAllDay() && object.startDate) {
					timedIntervals.push({
						start: object.startDate.getInTimezone(timezone).jsDate.getTime(),
						end: object.endDate ? object.endDate.getInTimezone(timezone).jsDate.getTime() : null,
					})
				}
			}
		} catch {
			// Other calendars only sharpen the flow limit; ignore their errors
		}
	}
	timedIntervals.sort((a, b) => a.start - b.start)
	const flowSlotsUntilNextEvent = (jsEnd) => {
		const next = timedIntervals.find((interval) => interval.start >= jsEnd.getTime())
		if (next === undefined) {
			return null
		}
		return Math.min(32, Math.max(0, Math.floor((next.start - jsEnd.getTime()) / (slotMinutes * 60 * 1000))))
	}

	const fcEvents = []
	for (const calendarObject of calendarObjects) {
		const allObjectsInTimeRange = objectsInRange.get(calendarObject)
		if (!allObjectsInTimeRange) {
			continue
		}
		for (const object of allObjectsInTimeRange) {
			const classNames = []

			let jsStart, jsEnd
			if (object.name === 'VEVENT') {
				jsStart = object.startDate.getInTimezone(timezone).jsDate
				jsEnd = object.endDate.getInTimezone(timezone).jsDate
			} else if (object.name === 'VTODO') {
				// For tasks, we only want to display when it is due,
				// not for how long it has been in progress already
				// if there is no due date, we store the task in the
				// tasksstore, so user can add it to the calendar if
				// he wants
				if (object.endDate === null) {
					jsStart = null
					jsEnd = null
				} else {
					jsStart = object.endDate.getInTimezone(timezone).jsDate
					jsEnd = object.endDate.getInTimezone(timezone).jsDate
				}
			} else {
				// We do not want to display anything that's neither
				// an event nor a task
				continue
			}

			// Technically, an event's end is not allowed to be equal to it's start,
			// because the event's end is exclusive. Most calendar applications
			// (including all big ones) allow creating such events anyway (we do too).
			// If the event's start is equal to it's end, fullcalendar is giving
			// the event a default length of one hour. We are preventing that by
			// adding one second to the end in that case.
			if (jsStart && jsEnd && jsStart.getTime() === jsEnd.getTime()) {
				jsEnd.setSeconds(jsEnd.getSeconds() + 1)
			}

			// Participation status is also applied to past events, so the status
			// remains readable retrospectively. Past events only get a lighter
			// color (see eventDidMount).

			// You are an organizer
			if (object.getFirstPropertyFirstValue('ORGANIZER') === `mailto:${principalsStore.getCurrentUserPrincipalEmail}`) {
				// Check if all the attendees have declined the event
				if (object.hasProperty('ATTENDEE')) {
					let didEveryoneDecline = true
					for (const attendeeProperty of object.getPropertyIterator('ATTENDEE')) {
						const hasDeclined = attendeeProperty.participationStatus === 'DECLINED'
						if (!hasDeclined) {
							didEveryoneDecline = false
						}
					}
					if (didEveryoneDecline) {
						classNames.push('fc-event-nc-all-declined')
					}
				}
			}

			if (object.status === 'TENTATIVE') {
				classNames.push('fc-event-nc-tentative')
			}

			// You are invited
			for (const attendeeProperty of object.getPropertyIterator('ATTENDEE')) {
				if (attendeeProperty.email === `mailto:${principalsStore.getCurrentUserPrincipalEmail}`) {
					if (attendeeProperty.participationStatus === 'DECLINED') {
						classNames.push('fc-event-nc-declined')
					} else if (attendeeProperty.participationStatus === 'TENTATIVE') {
						classNames.push('fc-event-nc-tentative')
					} else if (attendeeProperty.participationStatus === 'NEEDS-ACTION') {
						classNames.push('fc-event-nc-needs-action')
					}
				}
			}

			if (object.status === 'CANCELLED') {
				classNames.push('fc-event-nc-cancelled')
			}

			if (object.hasComponent('VALARM')) {
				classNames.push('fc-event-nc-alarms')
			}

			if (object.name === 'VEVENT') {
				const transparency = transparencyOverride
					?? ((object.getFirstPropertyFirstValue('TRANSP') === 'TRANSPARENT') ? 'transparent' : 'opaque')
				if (transparency === 'transparent') {
					classNames.push('fc-event-nc-free')
				}
			}

			if (object.name === 'VEVENT' && jsStart && jsEnd) {
				// The event's duration travels as a quantized class so pure
				// CSS can size the duration line above the title (anything
				// applied to the element outside the event definition is
				// dropped on in-place re-renders)
				const durationHours = Math.min(
					DURATION_CLASS_MAX_HOURS,
					Math.max(1, Math.round((jsEnd.getTime() - jsStart.getTime()) / (60 * 60 * 1000))),
				)
				classNames.push('fc-event-nc-has-duration', `fc-event-nc-duration-${durationHours}`)

				// Events crossing into other days stretch the duration line
				// to their end instead: it runs to the proportional position
				// of the end time within the last day (see the
				// fc-event-nc-ends-* rules in the CSS)
				const startDay = new Date(jsStart)
				startDay.setHours(0, 0, 0, 0)
				const lastDay = getLastCoveredDay(jsEnd)
				if (lastDay.getTime() > startDay.getTime()) {
					classNames.push('fc-event-nc-spans-days')
					const endHour = Math.round((jsEnd.getTime() - lastDay.getTime()) / (60 * 60 * 1000))
					if (endHour > 0 && endHour < 24) {
						classNames.push(`fc-event-nc-ends-${endHour}`)
					}
				}

				if (!object.isAllDay()) {
					const flowSlots = flowSlotsUntilNextEvent(jsEnd)
					if (flowSlots !== null) {
						classNames.push(`fc-event-nc-flow-${flowSlots}`)
					}

					// The description gets a line budget with a real ellipsis:
					// every text line is one slot high, the time takes one, the
					// title up to two; the rest of the box plus the allowed
					// flow is left for the description (see the
					// fc-event-nc-desc-lines-* rules in the CSS). Parallel
					// events flow the same way - their narrow side-by-side
					// boxes keep the text in its column.
					if (object.description) {
						const boxSlots = Math.max(1, Math.round((jsEnd.getTime() - jsStart.getTime()) / (slotMinutes * 60 * 1000)))
						const overhang = flowSlots === null ? 40 : Math.max(0, flowSlots - 1)
						const descLines = Math.max(0, Math.min(40, boxSlots + overhang - 3))
						classNames.push(`fc-event-nc-desc-lines-${descLines}`)
					}

					// Stacking in the week/day grids follows the start time:
					// later events paint above the title and description text
					// flowing out of earlier ones (see the fc-event-nc-starts-*
					// rules in the CSS)
					const startSlot = Math.min(47, Math.floor((jsStart.getHours() * 60 + jsStart.getMinutes()) / 30))
					classNames.push(`fc-event-nc-starts-${startSlot}`)
				}
			}

			if (object.name === 'VTODO') {
				classNames.push('fc-event-nc-task')
				if (object.percent === 100 || object.status === 'COMPLETED') {
					classNames.push('fc-event-nc-task-completed')
				}
			}

			let title
			if (object.name === 'VEVENT') {
				if (object.title) {
					title = object.title.replace(/\n/g, ' ')
				} else {
					title = t('calendar', 'Untitled event')
				}
			} else {
				if (object.title) {
					title = object.title.replace(/\n/g, ' ')
				} else {
					title = t('calendar', 'Untitled task')
				}

				if (object.percent !== null) {
					title += ` (${object.percent}%)`
				}
			}

			const attendeeCount = object.hasProperty('ATTENDEE')
				? [...object.getPropertyIterator('ATTENDEE')].length
				: 0

			const fcEvent = {
				id: [calendarObject.id, object.id].join('###'),
				title,
				allDay: object.isAllDay(),
				start: jsStart,
				end: jsEnd,
				// start: formatLocal(jsStart, object.isAllDay()),
				// end: formatLocal(jsEnd, object.isAllDay()),
				classNames,
				extendedProps: {
					objectId: calendarObject.id,
					vobjectId: object.id,
					recurrenceId: object.getReferenceRecurrenceId()
						? object.getReferenceRecurrenceId().unixTime
						: null,
					canModifyAllDay: object.canModifyAllDay(),
					calendarOrder: calendar.order,
					calendarName: calendar.displayName,
					calendarId: calendar.id,
					darkText: isLight(hexToRGB(calendar.color)),
					objectType: object.name,
					percent: object.percent || null,
					davUrl: calendarObject.dav.url,
					location: object.location,
					description: object.description,
					attendeeCount,
				},
			}

			if (object.color) {
				const customColor = getHexForColorName(object.color)
				if (customColor) {
					fcEvent.backgroundColor = customColor
					fcEvent.borderColor = customColor
				}
			}

			// Past events keep their formatting; only their color anchor (bar,
			// dot, left border) is lightened, preserving hue and saturation.
			// The lightened color is part of the event definition so it
			// survives fullcalendar re-rendering the event element in place,
			// which drops anything applied to the element after the fact.
			if (jsEnd && jsEnd.getTime() < Date.now()) {
				const lightened = lightenColorForPastEvents(fcEvent.borderColor ?? calendar.color)
				if (lightened) {
					fcEvent.borderColor = lightened
				}
			}
			if (searchTerms.length > 0) {
				const organizerProperty = object.getFirstProperty('ORGANIZER')
				const organizerText = organizerProperty
					? [organizerProperty.commonName, organizerProperty.email?.replace('mailto:', '')].filter(Boolean).join(' ')
					: ''
				const attendeeText = [...object.getPropertyIterator('ATTENDEE')]
					.map((a) => [a.commonName, a.email?.replace('mailto:', '')].filter(Boolean).join(' '))
					.join(' ')
				const haystack = [title, object.location, object.description, organizerText, attendeeText]
					.filter(Boolean).join(' ').toLowerCase()
				if (!searchTerms.some((term) => haystack.includes(term))) {
					continue
				}
			}

			if (object.name === 'VTODO' && object.endDate === null && object.percent !== 100 && object.status !== 'COMPLETED') {
				fcEvent.create = true
				tasksStore.appendTask(calendar.id, fcEvent)
				continue
			}

			// In the week and day grids, timed events spanning three or more
			// calendar days do not occupy all time slots of the days in
			// between. They are split into the timed start and end parts plus
			// an all-day "bridge" for the days in between, which renders
			// unobtrusively in the all-day row. All parts belong to the same
			// event: they share its object id, so opening any of them edits
			// the event as a whole.
			const isTimeGridView = typeof viewType === 'string' && viewType.startsWith('timeGrid')
			let spansThreeOrMoreDays = false
			if (object.name === 'VEVENT' && !object.isAllDay() && jsStart && jsEnd) {
				const startMidnight = new Date(jsStart)
				startMidnight.setHours(0, 0, 0, 0)
				spansThreeOrMoreDays = getLastCoveredDay(jsEnd).getTime() - startMidnight.getTime()
					>= 2 * 24 * 60 * 60 * 1000
			}

			if (isTimeGridView && spansThreeOrMoreDays) {
				const secondDayStart = new Date(jsStart)
				secondDayStart.setHours(0, 0, 0, 0)
				secondDayStart.setDate(secondDayStart.getDate() + 1)
				const lastDayStart = getLastCoveredDay(jsEnd)

				// The parts show the real event times instead of their own
				const extendedProps = {
					...fcEvent.extendedProps,
					realStart: jsStart,
					realEnd: jsEnd,
				}

				fcEvents.push({
					...fcEvent,
					id: `${fcEvent.id}-start`,
					end: secondDayStart,
					extendedProps,
				}, {
					...fcEvent,
					id: `${fcEvent.id}-bridge`,
					allDay: true,
					start: secondDayStart,
					end: new Date(lastDayStart),
					startEditable: false,
					durationEditable: false,
					// The bridge ends at a day boundary, so it must not carry
					// the proportional end-time position of the whole event
					classNames: [
						...classNames.filter((name) => !name.startsWith('fc-event-nc-ends-')),
						'fc-event-nc-bridge',
					],
					extendedProps,
				}, {
					...fcEvent,
					id: `${fcEvent.id}-end`,
					start: new Date(lastDayStart),
					// The end part starts at midnight, not at the event start
					classNames: [
						...classNames.filter((name) => !name.startsWith('fc-event-nc-starts-')),
						'fc-event-nc-starts-0',
					],
					extendedProps,
				})
				continue
			}

			fcEvents.push(fcEvent)
		}
		tasksStore.finishCalendar(calendar.id)
	}

	return fcEvents
}
