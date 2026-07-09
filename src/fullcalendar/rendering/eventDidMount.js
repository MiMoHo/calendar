/**
 * SPDX-FileCopyrightText: 2019 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { getCanonicalLocale, translate as t } from '@nextcloud/l10n'
import { formatDateWithTimezone, isMultiDayAllDayEvent } from '../../utils/date.js'
import { errorCatch } from '../utils/errors.js'

/**
 * Build time description for all-day events
 *
 * @param {EventApi} event The event
 * @param {string|undefined} locale Locale for event time formatting
 * @return {string} Time description
 */
function buildAllDayTimeDescription(event, locale) {
	if (!event.start) {
		return ''
	}

	const dateOptions = {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	}
	const startStr = formatDateWithTimezone(event.start, locale, dateOptions)

	if (!event.end || !isMultiDayAllDayEvent(event.start, event.end)) {
		return startStr
	}

	// Multi-day event: calculate end date (exclusive, so subtract 1 day)
	const adjustedEnd = new Date(event.end)
	adjustedEnd.setDate(adjustedEnd.getDate() - 1)
	const endStr = formatDateWithTimezone(adjustedEnd, locale, dateOptions)

	return t('calendar', '{startDate} to {endDate}', {
		startDate: startStr,
		endDate: endStr,
	})
}

/**
 * Build time description for timed events
 *
 * @param {EventApi} event The event
 * @param {string|undefined} locale The locale to use
 * @return {string} Time description
 */
function buildTimedEventDescription(event, locale) {
	if (!event.start) {
		return ''
	}

	const dateTimeOptions = {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
	}
	const timeOptions = {
		hour: 'numeric',
		minute: 'numeric',
	}

	const startStr = formatDateWithTimezone(event.start, locale, dateTimeOptions, true)

	if (!event.end) {
		return startStr
	}

	// Check if same day - only show time for end
	const sameDay = event.start.toDateString() === event.end.toDateString()
	if (sameDay) {
		const endTimeStr = formatDateWithTimezone(event.end, locale, timeOptions, true)
		return t('calendar', '{startDateTime} to {endTime}', {
			startDateTime: startStr,
			endTime: endTimeStr,
		})
	}

	// Multi-day timed event
	const endStr = formatDateWithTimezone(event.end, locale, dateTimeOptions, true)
	return t('calendar', '{startDateTime} to {endDateTime}', {
		startDateTime: startStr,
		endDateTime: endStr,
	})
}

/**
 * Builds an accessible label for a calendar event including its title and time.
 *
 * @param {EventApi} event The fullcalendar event object
 * @return {string} A human-readable label for screen readers
 */
function buildAriaLabel(event) {
	const locale = getCanonicalLocale() || undefined
	const title = event.title || t('calendar', 'Untitled event')

	if (event.allDay) {
		const timeDescription = buildAllDayTimeDescription(event, locale)
		if (timeDescription) {
			return t('calendar', '{title}, All day: {timeDescription}', {
				title,
				timeDescription,
			})
		}
		return t('calendar', '{title}, All day', { title })
	}

	const timeDescription = buildTimedEventDescription(event, locale)
	if (timeDescription) {
		return t('calendar', '{title}, {timeDescription}', {
			title,
			timeDescription,
		})
	}
	return title
}

/**
 * Adds data to the html element representing the event in the fullcalendar grid.
 * This is used to later on position the popover
 *
 * @param {object} data The destructuring object
 * @param {EventApi} data.event The fullcalendar event object
 * @param {Node} data.el The HTML element
 */
export default errorCatch(function({ event, el }) {
	const hasParticipationTooltip = el.classList.contains('fc-event-nc-all-declined')
		|| el.classList.contains('fc-event-nc-needs-action')
		|| el.classList.contains('fc-event-nc-declined')

	// Set aria-label for screen reader accessibility
	el.setAttribute('aria-label', buildAriaLabel(event))
	if (el.classList.contains('fc-event-nc-alarms') && !el.classList.contains('fc-list-event')) {
		const notificationIcon = document.createElement('span')
		notificationIcon.classList.add('icon-event-reminder')
		notificationIcon.setAttribute('aria-hidden', 'true')
		if (event.extendedProps.darkText) {
			notificationIcon.classList.add('icon-event-reminder--dark')
		} else {
			notificationIcon.classList.add('icon-event-reminder--light')
		}
		el.firstChild.appendChild(notificationIcon)
	}

	if (el.classList.contains('fc-event-nc-task')) {
		if (el.classList.contains('fc-list-event')) {
			// List view
			const dotElement = el.querySelector('.fc-list-event-dot')
			dotElement.classList.remove('fc-list-event-dot')
			dotElement.classList.add('fc-list-event-checkbox')
			dotElement.style.color = 'var(--color-main-text)'

			if (event.extendedProps.percent === 100) {
				dotElement.classList.add('calendar-grid-checkbox-checked')
			} else {
				dotElement.classList.add('calendar-grid-checkbox')
			}
		} else if (el.classList.contains('fc-daygrid-dot-event')) {
			// Dot event in day grid view
			const dotElement = el.querySelector('.fc-daygrid-event-dot')
			dotElement.classList.remove('fc-daygrid-event-dot')
			dotElement.classList.add('fc-daygrid-event-checkbox')
			dotElement.style.color = 'var(--color-main-text)'

			if (event.extendedProps.percent === 100) {
				dotElement.classList.add('calendar-grid-checkbox-checked')
			} else {
				dotElement.classList.add('calendar-grid-checkbox')
			}
		} else {
			// AgendaView and all-day grid view
			const titleContainer = el.querySelector('.fc-event-title-container')
			const checkboxElement = document.createElement('div')
			checkboxElement.classList.add('fc-event-title-checkbox')
			if (event.extendedProps.percent === 100) {
				checkboxElement.classList.add('calendar-grid-checkbox-checked')
			} else {
				checkboxElement.classList.add('calendar-grid-checkbox')
			}

			titleContainer.prepend(checkboxElement)
		}
	}

	if (
		el.classList.contains('fc-event-nc-free')
		&& !el.classList.contains('fc-list-event')
		&& !el.classList.contains('fc-daygrid-dot-event')
	) {
		el.style.setProperty('--nc-event-color', el.style.borderColor)
	}

	if (event.source === null) {
		el.dataset.isNew = 'yes'
	} else {
		el.dataset.objectId = event.extendedProps.objectId
		el.dataset.recurrenceId = event.extendedProps.recurrenceId
	}

	if (el.classList.contains('fc-list-event')) {
		const locationContainer = document.createElement('td')
		locationContainer.classList.add('fc-list-event-location')
		const descriptionContainer = document.createElement('td')
		descriptionContainer.classList.add('fc-list-event-description')

		el.appendChild(locationContainer)
		el.appendChild(descriptionContainer)

		if (event.extendedProps.location) {
			const location = document.createElement('span')
			location.appendChild(document.createTextNode(event.extendedProps.location))
			locationContainer.appendChild(location)
		}

		if (event.extendedProps.description) {
			const description = document.createElement('span')
			description.appendChild(document.createTextNode(event.extendedProps.description))
			descriptionContainer.appendChild(description)
		}
	}

	if (hasParticipationTooltip) {
		el.title = t('calendar', 'All participants declined')

		if (el.classList.contains('fc-event-nc-needs-action')) {
			el.title = t('calendar', 'Participation not confirmed')
		}

		if (el.classList.contains('fc-event-nc-declined')) {
			el.title = t('calendar', 'You declined this event')
		}
	}

	if (
		event.extendedProps.attendeeCount >= 1
		&& !el.classList.contains('fc-event-nc-task')
	) {
		prependTitleIcon(el, 'M40-160v-112q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v112H40Zm640 0v-112q0-51-26-95.5T586-441q51 6 98 20.5t84 35.5q36 20 57 44.5t21 52.5v112H680ZM360-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm400-160q0 66-47 113t-113 47q-11 0-28-2.5t-28-5.5q27-32 41.5-71t14.5-81q0-42-14.5-81T544-792q14-5 28-6.5t28-1.5q66 0 113 47t47 113Z')
	}

	if (el.classList.contains('fc-event-nc-all-declined')) {
		prependTitleIcon(el, 'm40-120 440-760 440 760H40Zm440-120q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm-40-120h80v-200h-80v200Z')
	}

	if (el.classList.contains('fc-event-nc-tentative')) {
		// Tentative events are marked by a dashed frame (dashed dot ring for dot
		// events) instead of a fill pattern — see CSS. Diagonal stripes used to be
		// applied here, but they read as "cancelled" rather than "uncertain".
		el.title = t('calendar', 'Your participation is tentative')
	}
}, 'eventDidMount')

/**
 * Prepend a Material Symbols SVG icon to an event's title element.
 * The icon is coloured with the event's border colour and sized to match the text.
 *
 * @param {HTMLElement} el The root element of the fullcalendar event
 * @param {string} svgPath The `d` attribute of the SVG path to render
 */
function prependTitleIcon(el, svgPath) {
	// List rows carry their title in an anchor inside the title cell
	const titleElement = el.querySelector('.fc-event-title')
		?? el.querySelector('.fc-list-event-title a')
		?? el.querySelector('.fc-list-event-title')
	if (!titleElement) {
		return
	}

	// Avoid duplicating icons when eventDidMount is called again (e.g. after a click).
	const existingSvgs = titleElement.querySelectorAll('svg')
	for (const svg of existingSvgs) {
		const path = svg.querySelector('path')
		if (path && path.getAttribute('d') === svgPath) {
			return
		}
	}

	const svgNS = 'http://www.w3.org/2000/svg'
	const svgElement = document.createElementNS(svgNS, 'svg')
	svgElement.setAttribute('viewBox', '0 -960 960 960')
	const pathElement = document.createElementNS(svgNS, 'path')
	pathElement.setAttribute('d', svgPath)
	svgElement.appendChild(pathElement)
	svgElement.style.fill = el.style.borderColor
	svgElement.style.width = '1em'
	svgElement.style.marginBottom = '0.2em'
	svgElement.style.verticalAlign = 'middle'
	titleElement.insertBefore(svgElement, titleElement.firstChild)
}
