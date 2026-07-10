<!--
  - SPDX-FileCopyrightText: 2020 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<FullCalendar
		ref="fullCalendar"
		:class="isWidget ? 'fullcalendar-widget' : ''"
		:options="options" />
</template>

<script>

import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import multiMonthPlugin from '@fullcalendar/multimonth'
import timeGridPlugin from '@fullcalendar/timegrid'
// Import FullCalendar itself
import FullCalendar from '@fullcalendar/vue3'
import { DateTimeValue } from '@nextcloud/calendar-js'
// Import other dependencies
import debounce from 'debounce'
import { mapState, mapStores } from 'pinia'
// Import event sources
import eventSource from '../fullcalendar/eventSources/eventSource.js'
// Import interaction handlers
import eventAllow from '../fullcalendar/interaction/eventAllow.js'
import eventClick from '../fullcalendar/interaction/eventClick.js'
import eventDrop from '../fullcalendar/interaction/eventDrop.js'
import eventResize from '../fullcalendar/interaction/eventResize.js'
import navLinkDayClick from '../fullcalendar/interaction/navLinkDayClick.js'
import navLinkWeekClick from '../fullcalendar/interaction/navLinkWeekClick.js'
import select from '../fullcalendar/interaction/select.js'
// Import localization plugins
import { getDateFormattingConfig } from '../fullcalendar/localization/dateFormattingConfig.js'
import { getFullCalendarLocale } from '../fullcalendar/localization/localeProvider.js'
import momentPlugin from '../fullcalendar/localization/momentPlugin.js'
// Import rendering handlers
import dayCellDidMount from '../fullcalendar/rendering/dayCellDidMount.js'
import dayHeaderDidMount from '../fullcalendar/rendering/dayHeaderDidMount.js'
import eventContent from '../fullcalendar/rendering/eventContent.ts'
import eventDidMount from '../fullcalendar/rendering/eventDidMount.js'
import {
	allDayFirst,
	allDayOrder,
	partDayOrder,
} from '../fullcalendar/rendering/eventOrder.js'
import noEventsDidMount from '../fullcalendar/rendering/noEventsDidMount.js'
// Import timezone plugins
import VTimezoneNamedTimezone from '../fullcalendar/timezones/vtimezoneNamedTimezoneImpl.js'
import useCalendarObjectsStore from '../store/calendarObjects.js'
import useCalendarsStore from '../store/calendars.js'
import useFetchedTimeRangesStore from '../store/fetchedTimeRanges.js'
import useSettingsStore from '../store/settings.js'
import useWidgetStore from '../store/widget.js'
import { getAllObjectsInTimeRange } from '../utils/calendarObject.js'
import { getYYYYMMDDFromFirstdayParam } from '../utils/date.js'

export default {
	name: 'CalendarGrid',
	components: {
		FullCalendar,
	},

	props: {
		isWidget: {
			type: Boolean,
			default: false,
		},

		url: {
			type: String,
			required: false,
		},

		/**
		 * Whether or not the user is authenticated
		 */
		isAuthenticatedUser: {
			type: Boolean,
			required: true,
		},
	},

	data() {
		return {
			updateTodayJob: null,
			updateTodayJobPreviousDate: null,
		}
	},

	computed: {
		...mapStores(
			useCalendarsStore,
			useSettingsStore,
			useCalendarObjectsStore,
			useFetchedTimeRangesStore,
		),

		...mapState(useSettingsStore, {
			locale: 'momentLocale',
			timezoneId: 'getResolvedTimezone',
		}),

		...mapState(useSettingsStore, [
			'eventLimit',
			'showWeekends',
			'showWeekNumbers',
			'slotDuration',
			'searchQuery',
		]),

		...mapState(useCalendarObjectsStore, ['modificationCount']),

		allCalendarsLoaded() {
			const calendars = this.calendarsStore?.calendars ?? []
			return calendars.length > 0 && calendars.every((calendar) => !calendar.loading)
		},

		calendarObjectCount() {
			return Object.keys(this.calendarObjectsStore?.calendarObjects ?? {}).length
		},

		...mapState(useWidgetStore, [
			'widgetView',
			'widgetDate',
		]),

		options() {
			return {
				// Initialization:
				initialDate: getYYYYMMDDFromFirstdayParam(this.$route?.params?.firstDay ?? 'now'),
				initialView: this.$route?.params.view ?? 'dayGridMonth',
				// Data
				eventSources: this.eventSources,
				// Plugins
				plugins: this.plugins,
				// Interaction
				editable: this.isEditable,
				selectable: this.isAuthenticatedUser,
				eventAllow,
				eventClick: eventClick(this.$router, this.$route, window, this.isWidget, this.$refs),
				eventDrop: this.isWidget ? false : (...args) => eventDrop(this.$refs.fullCalendar.getApi())(...args),
				eventResize: this.isWidget ? false : eventResize(),
				eventResizableFromStart: true,
				navLinkDayClick: this.isWidget ? false : navLinkDayClick(this.$router, this.$route),
				navLinkWeekClick: this.isWidget ? false : navLinkWeekClick(this.$router, this.$route),
				select: this.isWidget ? false : select(this.$router, this.$route, window),
				navLinks: true,
				selectLongPressDelay: 500,
				// Localization
				...getDateFormattingConfig(),
				...getFullCalendarLocale(),
				// Rendering
				dayCellDidMount,
				dayHeaderDidMount,
				eventContent,
				eventDidMount,
				noEventsDidMount,
				// All day-grid events render as blocks: the vertical bar marks
				// busy/free, the thin bar above the title shows the duration
				eventDisplay: 'block',
				eventOrder: [allDayFirst, allDayOrder, partDayOrder],
				// Parallel events get real side-by-side columns instead of the
				// full-width overlay, so their flowing text stays in its column
				slotEventOverlap: false,
				forceEventDuration: false,
				headerToolbar: false,
				height: '100%',
				slotDuration: this.slotDuration,
				expandRows: true,
				weekNumbers: this.showWeekNumbers,
				weekends: this.showWeekends,
				dayMaxEventRows: this.eventLimit,
				views: {
					// The all-day section must not squeeze the hour grid off
					// the screen: past five stacked levels a "+ more" link
					// takes over (the month grid keeps the user setting)
					timeGridWeek: {
						dayMaxEventRows: 5,
					},

					timeGridDay: {
						dayMaxEventRows: 5,
					},

					multiMonthYear: {
						// fullcalendar's multi-month view always limits event rows
						// by cell height (it hardcodes dayMaxEventRows: true), so
						// the cells are made tall enough for three compact rows via
						// the aspect ratio; more events collapse into an outlined
						// counter box (see CSS)
						aspectRatio: 1.0,
						displayEventTime: false,
						moreLinkContent: (arg) => String(arg.num),
						// Two months per row on typical screens: one on phones,
						// more only on very wide screens
						multiMonthMinWidth: 600,
					},
				},

				selectMirror: true,
				lazyFetching: false,
				nowIndicator: true,
				progressiveEventRendering: true,
				unselectAuto: false,
				// Timezones:
				timeZone: this.timezoneId,
				// Disable jumping in week view and day view when clicking on any event using the simple editor
				scrollTimeReset: false,
				// There is a custom resize observer
				handleWindowResize: false,
				// Dropping Tasks
				droppable: true,
				eventReceive: this.handleEventReceive,
				eventShortHeight: 38,
				loading: this.scrollMonthViewToToday,
			}
		},

		eventSources() {
			const getViewType = () => this.$refs.fullCalendar?.getApi()?.view?.type
				?? this.$route?.params?.view
				?? null
			if (this.isWidget) {
				const calendar = this.calendarsStore.getCalendarByUrl(this.url)
				if (!calendar) {
					return []
				}
				return [calendar].map(eventSource(getViewType))
			}
			return this.calendarsStore.enabledCalendars.map(eventSource(getViewType))
		},

		/**
		 * FullCalendar Plugins
		 *
		 * @return {(PluginDef)[]}
		 */
		plugins() {
			return [
				momentPlugin,
				VTimezoneNamedTimezone,
				dayGridPlugin,
				interactionPlugin,
				listPlugin,
				timeGridPlugin,
				multiMonthPlugin,
			]
		},

		isEditable() {
			// We do not allow drag and drop when the editor is open.
			return this.isAuthenticatedUser
				&& this.$route?.name !== 'EditPopoverView'
				&& this.$route?.name !== 'EditFullView'
		},
	},

	watch: {
		widgetView(newView) {
			const calendarApi = this.$refs.fullCalendar.getApi()
			calendarApi.changeView(newView)
		},

		widgetDate(newDate) {
			const calendarApi = this.$refs.fullCalendar.getApi()
			calendarApi.gotoDate(getYYYYMMDDFromFirstdayParam(newDate))
		},

		modificationCount: debounce(function() {
			const calendarApi = this.$refs.fullCalendar.getApi()
			calendarApi.refetchEvents()
		}, 50),

		// The flow limits consider the events of all calendars, but sources
		// resolve one calendar at a time; one refetch after the last one
		// finishes lets every event see all neighbours
		allCalendarsLoaded(loaded) {
			if (loaded) {
				const calendarApi = this.$refs.fullCalendar?.getApi()
				calendarApi?.refetchEvents()
			}
		},

		// Newly fetched objects of one calendar sharpen the flow limits of
		// the others; re-render once the fetches settle (cached sources
		// skip unchanged objects, so this cannot loop)
		calendarObjectCount: debounce(function() {
			const calendarApi = this.$refs.fullCalendar?.getApi()
			calendarApi?.refetchEvents()
		}, 300),

		searchQuery: debounce(function() {
			const calendarApi = this.$refs.fullCalendar.getApi()
			calendarApi.refetchEvents()
		}, 300),
	},

	/**
	 * FullCalendar 5 is using calculated px values for the width
	 * of its views.
	 * Hence a simple `width: 100%` won't assure that the calendar-grid
	 * is always using the full available width.
	 *
	 * Toggling the AppNavigation or AppFull will change the amount
	 * of available space, but it will not be covered by the window
	 * resize event, because the actual window size did not change.
	 *
	 * To make sure, that the calendar-grid is always using all space,
	 * we have to register a resize-observer here, that will automatically
	 * update the fullCalendar size, when the available space changes.
	 */
	mounted() {
		if (window.ResizeObserver) {
			const resizeObserver = new ResizeObserver(debounce(() => {
				this.$refs.fullCalendar
					.getApi()
					.updateSize()
			}, 100))

			resizeObserver.observe(this.$refs.fullCalendar.$el)
		}

		// Delegated, so it survives fullcalendar re-rendering its DOM
		this.$el.addEventListener('wheel', this.forwardHeaderWheel, { passive: false })
	},

	beforeUnmount() {
		this.$el.removeEventListener('wheel', this.forwardHeaderWheel)
	},

	async created() {
		this.updateTodayJob = setInterval(() => {
			const newDate = getYYYYMMDDFromFirstdayParam('now')

			if (this.updateTodayJobPreviousDate === null) {
				this.updateTodayJobPreviousDate = newDate
				return
			}

			if (this.updateTodayJobPreviousDate !== newDate) {
				this.updateTodayJobPreviousDate = newDate

				const calendarApi = this.$refs.fullCalendar.getApi()
				calendarApi.render()
			}
		}, 1000)

		/**
		 * This view is not used as a router view,
		 * hence we can't use beforeRouteUpdate directly.
		 */
		if (!this.isWidget) {
			this.$router.beforeEach((to, from, next) => {
				if (to.params.firstDay !== from.params.firstDay) {
					const calendarApi = this.$refs.fullCalendar.getApi()
					calendarApi.gotoDate(getYYYYMMDDFromFirstdayParam(to.params.firstDay))
				}
				if (to.params.view !== from.params.view) {
					const calendarApi = this.$refs.fullCalendar.getApi()
					calendarApi.changeView(to.params.view)
					this.saveNewView(to.params.view)
				}

				if ((from.name === 'NewPopoverView' || from.name === 'NewFullView')
					&& to.name !== 'NewPopoverView'
					&& to.name !== 'NewFullView') {
					const calendarApi = this.$refs.fullCalendar.getApi()
					calendarApi.unselect()
				}

				next()
			})

			// Trigger the select event programmatically on initial page load to show the new event
			// in the grid. Wait for the next tick because the ref isn't available right away.
			await this.$nextTick()
			if (['NewPopoverView', 'NewFullView'].includes(this.$route.name)) {
				const start = new Date(parseInt(this.$route.params.dtstart) * 1000)
				const end = new Date(parseInt(this.$route.params.dtend) * 1000)
				if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
					const calendarApi = this.$refs.fullCalendar.getApi()
					calendarApi.select({
						start,
						end,
						allDay: this.$route.params.allDay === '1',
					})
				}
			}
		}
	},

	methods: {
		/**
		 * The sticky header of the time grids (day headers and the all-day
		 * events) does not scroll itself, so wheeling over it did nothing.
		 * Forward those wheels to the hour grid below - especially with
		 * many all-day events the mouse easily rests on the header.
		 *
		 * @param {WheelEvent} event The wheel event
		 */
		forwardHeaderWheel(event) {
			const view = event.target.closest('.fc-timeGridWeek-view, .fc-timeGridDay-view')
			if (!view || event.deltaY === 0) {
				return
			}

			const scroller = view.querySelector('.fc-timegrid-body')?.closest('.fc-scroller')
			if (!scroller || scroller.contains(event.target)) {
				// Over the hour grid the native scrolling handles it
				return
			}

			event.preventDefault()
			// deltaMode: 0 = pixels, 1 = lines, 2 = pages
			const factor = event.deltaMode === 1 ? 24 : (event.deltaMode === 2 ? scroller.clientHeight : 1)
			scroller.scrollTop += event.deltaY * factor
		},

		/**
		 * Scroll the month view to today when loading the calendar,
		 * so people can directly see today's date and events.
		 */
		scrollMonthViewToToday(isLoading) {
			if (isLoading) {
				return
			}
			const calendarApi = this.$refs.fullCalendar.getApi()
			if (calendarApi.view.type !== 'dayGridMonth') {
				return
			}
			this.$nextTick(() => {
				const todayEl = this.$refs.fullCalendar.$el.querySelector('.fc-day-today')
				if (todayEl) {
					todayEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
				}
			})
		},

		/**
		 * When a user changes the view, remember it and
		 * use it the next time they open the calendar app
		 */
		saveNewView: debounce(function(initialView) {
			if (this.isAuthenticatedUser) {
				this.settingsStore.setInitialView({ initialView })
			}
		}, 5000),

		/**
		 * Add a todo task without end date to the calendar
		 */
		async handleEventReceive(info) {
			const { event } = info
			const { objectId, vobjectId, calendarId } = event.extendedProps

			// 1. Get the calenderobject by ID
			const calendarObject = this.calendarObjectsStore.getCalendarObjectById(objectId)

			// 2. Create the due date
			event.setEnd(event.start)
			const dueDate = DateTimeValue.fromJSDate(event.start, false)

			// 3. Update the 'DUE' property for the vtodo object
			const allObjectsInTimeRange = getAllObjectsInTimeRange(calendarObject, event.start, event.start)
			const vtodo = allObjectsInTimeRange.find((el) => el.id === vobjectId)

			// 3.1 Set to Date only value if view is month or year and start date is null or date only value
			const view = this.$route?.params.view
			const isDateOnlyView = view === 'dayGridMonth' || view === 'multiMonthYear'

			if (isDateOnlyView && (!vtodo.hasProperty('dtstart') || vtodo.startDate.isDate)) {
				dueDate.isDate = true
			} else if (!isDateOnlyView && vtodo.startDate?.isDate) {
				vtodo.startDate.isDate = false
			}

			// 3.2 Now do the actual update
			vtodo.deleteAllProperties('due') // Clean old one
			vtodo.updatePropertyWithValue('due', dueDate)

			// 4. Check if start date is before due date and fix it then
			if (vtodo.hasProperty('dtstart') && vtodo.startDate.compare(dueDate) >= 0) {
				const dtStart = dueDate.clone()
				vtodo.updatePropertyWithValue('dtstart', dtStart)
			}

			vtodo.undirtify()

			// 5. Update the calendarobject
			await this.calendarObjectsStore.updateCalendarObject({ calendarObject })

			// 6. Update the affected calendar (maybe unnecessary)
			const calendar = this.calendarsStore.getCalendarById(calendarId)

			const fetchedTimeRanges = this.fetchedTimeRangesStore
				.getAllTimeRangesForCalendar(calendar.id)
			for (const timeRange of fetchedTimeRanges) {
				this.fetchedTimeRangesStore.removeTimeRange({
					timeRangeId: timeRange.id,
				})
				this.calendarsStore.deleteFetchedTimeRangeFromCalendarMutation({
					calendar,
					fetchedTimeRangeId: timeRange.id,
				})
			}

			// 7. Remove the event that was created by full calendar
			event.remove()
		},
	},
}
</script>

<style scoped lang="scss">
.calendar-grid-checkbox {
	border-style: solid;
	border-width: 2px;
	border-radius: 4px;
	height: 16px;
	width: 16px;
}

.calendar-grid-checkbox-checked {
	border-style: solid;
	border-width: 8px;
	border-radius: 4px;
	height: 16px;
	width: 16px;
}

.fullcalendar-widget{
	min-height: 500px;
	:deep(.fc-col-header-cell-cushion){
		font-size: 9px;
	}
}
</style>
