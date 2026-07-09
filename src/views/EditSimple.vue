<!--
  - SPDX-FileCopyrightText: 2019 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div>
		<div
			v-if="showPopover && !isViewing"
			ref="mask"
			class="modal-mask"
			:class="{
				'modal-mask--opaque': dark,
				'modal-mask--light': lightBackdrop,
			}"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			@click.self="cancel(false)" />
		<div
			v-if="showPopover"
			class="event-popover"
			:style="{
				...popoverStyle,
				pointerEvents: popoverReady ? 'auto' : 'none',
				visibility: popoverReady ? 'visible' : 'hidden',
			}">
			<div class="event-popover__inner edit-simple">
				<template v-if="isLoading && !isSaving">
					<div class="event-popover__loading">
						<div class="icon icon-loading event-popover__loading-icon" />
					</div>
				</template>

				<template v-else-if="isError">
					<div class="event-popover__top-actions">
						<Actions>
							<ActionButton @click="cancel(false)">
								<template #icon>
									<Close :size="20" decorative />
								</template>
								{{ $t('calendar', 'Close') }}
							</ActionButton>
						</Actions>
					</div>

					<EmptyContent :name="$t('calendar', 'Event does not exist')" :description="error">
						<template #icon>
							<CalendarBlank :size="20" decorative />
						</template>
					</EmptyContent>
				</template>

				<template v-else-if="calendarObjectInstance">
					<div class="event-popover__top-actions">
						<NcPopover v-if="isViewedByOrganizer === false" :noFocusTrap="true">
							<template #trigger>
								<NcButton variant="tertiary-no-background">
									<template #icon>
										<HelpCircleIcon :size="20" />
									</template>
								</NcButton>
							</template>
							<template #default>
								<p class="warning-text">
									{{ $t('calendar', 'Modifications will not get propagated to the organizer and other attendees') }}
								</p>
							</template>
						</NcPopover>
						<NcColorPicker
							v-if="!isReadOnlyOrViewing"
							:modelValue="color || selectedCalendarColor"
							:advancedFields="true"
							@update:modelValue="updateColor">
							<button
								class="event-popover__color-dot"
								type="button"
								:aria-label="t('calendar', 'Event color')"
								:title="t('calendar', 'Event color')"
								:style="{ 'background-color': color || selectedCalendarColor }" />
						</NcColorPicker>
						<Actions v-if="!isLoading && !isError && !isNew" :forceMenu="true">
							<ActionButton v-if="eventLink" @click="copyEventLink()">
								<template #icon>
									<ContentCopy :size="20" decorative />
								</template>
								{{ $t('calendar', 'Copy link') }}
							</ActionButton>
							<ActionLink
								v-if="!hideEventExport && hasDownloadURL"
								:href="downloadURL">
								<template #icon>
									<Download :size="20" decorative />
								</template>
								{{ $t('calendar', 'Export') }}
							</ActionLink>
							<ActionButton v-if="!canCreateRecurrenceException && !isReadOnly" @click="duplicateEvent()">
								<template #icon>
									<ContentDuplicate :size="20" decorative />
								</template>
								{{ $t('calendar', 'Duplicate') }}
							</ActionButton>
							<ActionButton v-if="canDelete && !canCreateRecurrenceException" @click="deleteAndLeave(false)">
								<template #icon>
									<Delete :size="20" decorative />
								</template>
								{{ $t('calendar', 'Delete') }}
							</ActionButton>
							<ActionButton v-if="canDelete && canCreateRecurrenceException" @click="deleteAndLeave(false)">
								<template #icon>
									<Delete :size="20" decorative />
								</template>
								{{ $t('calendar', 'Delete this occurrence') }}
							</ActionButton>
							<NcActionSeparator v-if="canDelete && canCreateRecurrenceException" />
							<ActionButton v-if="canDelete && canCreateRecurrenceException" @click="deleteAndLeave(true)">
								<template #icon>
									<Delete :size="20" decorative />
								</template>
								{{ $t('calendar', 'Delete this and all future') }}
							</ActionButton>
						</Actions>
						<Actions>
							<ActionButton @click="cancel(false)">
								<template #icon>
									<Close :size="20" decorative />
								</template>
								{{ $t('calendar', 'Close') }}
							</ActionButton>
						</Actions>
					</div>

					<!-- Header -->
					<div class="event-popover__header">
						<CalendarPickerHeader
							:value="selectedCalendar"
							:calendars="calendars"
							:isReadOnly="isReadOnlyOrViewing || !canModifyCalendar"
							:isViewedByAttendee="isViewedByOrganizer === false"
							@update:value="changeCalendar" />

						<PropertyTitle
							:value="titleOrPlaceholder"
							:isReadOnly="isReadOnlyOrViewing || isViewedByOrganizer === false"
							:isCancelled="isCancelled"
							@update:value="updateTitle" />

						<div v-if="isCancelled" class="event-popover__cancelled">
							{{ $t('calendar', 'This event was cancelled') }}
						</div>
					</div>

					<!-- Content -->
					<div class="event-popover__content" :class="{ 'event-popover__content--viewing': isReadOnlyOrViewing }">
						<PropertyTitleTimePicker
							:startDate="startDate"
							:startTimezone="startTimezone"
							:endDate="endDate"
							:endTimezone="endTimezone"
							:isAllDay="isAllDay"
							:isReadOnly="isReadOnlyOrViewing || isViewedByOrganizer === false"
							:canModifyAllDay="canModifyAllDay"
							:userTimezone="currentUserTimezone"
							:wrap="true"
							@updateStartDate="updateStartDate"
							@updateStartTime="updateStartTime"
							@updateStartTimezone="updateStartTimezone"
							@updateEndDate="updateEndDate"
							@updateEndTime="updateEndTime"
							@updateEndTimezone="updateEndTimezone"
							@toggleAllDay="toggleAllDay">
							<template v-if="!isReadOnlyOrViewing" #afterTimezone>
								<div class="event-popover__all-day" :class="{ 'event-popover__all-day--all-day': isAllDay }">
									<NcCheckboxRadioSwitch
										:modelValue="isAllDay"
										:disabled="isViewedByOrganizer === false || isReadOnlyOrViewing || !canModifyAllDay"
										@update:modelValue="toggleAllDayPreliminary">
										{{ $t('calendar', 'All day') }}
									</NcCheckboxRadioSwitch>
								</div>
							</template>
						</PropertyTitleTimePicker>

						<Repeat
							v-if="!isReadOnlyOrViewing && calendarObjectInstance.recurrenceRule"
							:calendarObjectInstance="calendarObjectInstance"
							:recurrenceRule="calendarObjectInstance.recurrenceRule"
							:isReadOnly="isReadOnlyOrViewing || isViewedByOrganizer === false"
							:isEditingMasterItem="isEditingMasterItem"
							:isRecurrenceException="isRecurrenceException"
							@forceThisAndAllFuture="forceModifyingFuture" />

						<div class="event-popover__status-row">
							<PropertySelect
								:isReadOnly="isReadOnlyOrViewing"
								:propModel="rfcProps.status"
								:value="status"
								@update:value="updateStatus" />
							<PropertySelect
								:isReadOnly="isReadOnlyOrViewing"
								:propModel="rfcProps.timeTransparency"
								:value="timeTransparency"
								@update:value="updateTimeTransparency" />
						</div>

						<!-- In the viewing mode the reminders sit right below the
							status line, so a long description cannot push them
							out of sight -->
						<div v-if="isReadOnlyOrViewing && hasAlarms" class="property-alarm-wrapper">
							<Bell :size="20" class="property-alarm-icon" />
							<AlarmList
								:calendarObjectInstance="calendarObjectInstance"
								:isReadOnly="true" />
						</div>

						<PropertyText
							:isReadOnly="isReadOnlyOrViewing || isViewedByOrganizer === false"
							:propModel="rfcProps.location"
							:value="location"
							:linkifyLinks="true"
							@update:value="updateLocation" />
						<AddTalkModal
							v-if="isTalkModalOpen"
							:calendarObjectInstance="calendarObjectInstance"
							:delegatorUserId="delegatorUserId"
							@close="isTalkModalOpen = false"
							@updateLocation="updateLocation"
							@updateDescription="updateDescription" />

						<div class="event-popover__description-row">
							<PropertyText
								:isReadOnly="isReadOnlyOrViewing"
								:propModel="rfcProps.description"
								:value="description"
								:linkifyLinks="true"
								:isDescription="true"
								@update:value="updateDescription" />
							<!-- The conversation link mostly ends up in the description
								(the location only takes it while empty), so the button
								lives in the unused icon column next to it -->
							<NcButton
								v-if="isCreateTalkRoomButtonVisible && !isReadOnlyOrViewing"
								class="event-popover__talk-button"
								variant="secondary"
								:disabled="isCreateTalkRoomButtonDisabled"
								:ariaLabel="t('calendar', 'Add Talk conversation')"
								:title="t('calendar', 'Add Talk conversation')"
								@click="openTalkModal">
								<template #icon>
									<IconVideo :size="20" />
								</template>
							</NcButton>
						</div>

						<InviteesList
							v-if="!isViewing || (isViewing && hasAttendees)"
							class="event-popover__invitees"
							:hideButtons="true"
							:hideErrors="true"
							:showHeader="true"
							:compactHeader="true"
							:isReadOnly="isReadOnlyOrViewing || isViewedByOrganizer === false"
							:isSharedWithMe="isSharedWithMe"
							:calendar="selectedCalendar"
							:calendarObjectInstance="calendarObjectInstance" />

						<PropertySelect
							v-if="showInvitationForwarding && !isReadOnlyOrViewing"
							:isReadOnly="isReadOnlyOrViewing || isViewedByOrganizer === false"
							:propModel="propInvitationForwarding"
							:value="invitationForwarding"
							@update:value="updateInvitationForwarding" />

						<PropertySelect
							v-if="!isReadOnlyOrViewing"
							:isReadOnly="isReadOnlyOrViewing || isViewedByOrganizer === false"
							:propModel="rfcProps.accessClass"
							:value="accessClass"
							@update:value="updateAccessClass" />

						<InvitationResponseButtons
							v-if="isViewedByAttendee && isViewing"
							class="event-popover__response-buttons"
							:attendee="userAsAttendee"
							:calendarId="calendarId"
							@close="closeEditorAndSkipAction" />

						<div v-if="!isReadOnlyOrViewing" class="property-alarm-wrapper">
							<AlarmList
								:calendarObjectInstance="calendarObjectInstance"
								:isReadOnly="isReadOnlyOrViewing" />
						</div>

						<AttachmentsList
							v-if="!isReadOnlyOrViewing"
							:calendarObjectInstance="calendarObjectInstance"
							:isReadOnly="isReadOnlyOrViewing" />

						<PropertySelectMultiple
							v-if="!isReadOnlyOrViewing"
							class="property-categories"
							:coloredOptions="true"
							:isReadOnly="isReadOnlyOrViewing"
							:propModel="rfcProps.categories"
							:value="categories"
							@addSingleValue="addCategory"
							@removeSingleValue="removeCategory" />
					</div>

					<!-- Footer -->
					<div class="event-popover__footer">
						<SaveButtons
							v-if="!isWidget"
							class="event-popover__buttons"
							:canCreateRecurrenceException="canCreateRecurrenceException"
							:isNew="isNew"
							:isReadOnly="isReadOnlyOrViewing"
							:forceThisAndAllFuture="forceThisAndAllFuture"
							:showMoreButton="false"
							:disabled="isSaving"
							@saveThisOnly="saveAndView(false)"
							@saveThisAndAllFuture="saveAndView(true)">
							<!-- The editing popover carries the full option set, so
								'More details' IS the editor - the pencil says so -->
							<NcButton
								v-if="!isReadOnly && isViewing"
								:variant="isViewedByAttendee ? 'tertiary' : undefined"
								@click="isViewing = false">
								<template #icon>
									<EditIcon :size="20" />
								</template>
								{{ $t('calendar', 'More details') }}
							</NcButton>
						</SaveButtons>
					</div>
				</template>
			</div>
		</div>
		<NcDialog
			:open="showCancelDialog"
			class="cancel-confirmation-dialog"
			:name="t('calendar', 'Discard changes?')"
			:message="t('calendar', 'Are you sure you want to discard the changes made to this event?')"
			:buttons="cancelButtons"
			@update:open="showCancelDialog = $event" />
	</div>
</template>

<script>
import IconCancel from '@mdi/svg/svg/cancel.svg?raw'
import IconDelete from '@mdi/svg/svg/delete.svg?raw'
import {
	NcActionButton as ActionButton,
	NcActionLink as ActionLink,
	NcActions as Actions,
	NcEmptyContent as EmptyContent,
	NcActionSeparator,
	NcButton,
	NcCheckboxRadioSwitch,
	NcColorPicker,
	NcDialog,
	NcPopover,
} from '@nextcloud/vue'
import { mapState, mapStores } from 'pinia'
import Bell from 'vue-material-design-icons/BellOutline.vue'
import CalendarBlank from 'vue-material-design-icons/CalendarBlankOutline.vue'
import Close from 'vue-material-design-icons/Close.vue'
import ContentCopy from 'vue-material-design-icons/ContentCopy.vue'
import ContentDuplicate from 'vue-material-design-icons/ContentDuplicate.vue'
import HelpCircleIcon from 'vue-material-design-icons/HelpCircleOutline.vue'
import EditIcon from 'vue-material-design-icons/PencilOutline.vue'
import Delete from 'vue-material-design-icons/TrashCanOutline.vue'
import Download from 'vue-material-design-icons/TrayArrowDown.vue'
import IconVideo from 'vue-material-design-icons/VideoOutline.vue'
import AddTalkModal from '../components/Editor/AddTalkModal.vue'
import AlarmList from '../components/Editor/Alarm/AlarmList.vue'
import AttachmentsList from '../components/Editor/Attachments/AttachmentsList.vue'
import CalendarPickerHeader from '../components/Editor/CalendarPickerHeader.vue'
import InvitationResponseButtons
	from '../components/Editor/InvitationResponseButtons.vue'
import InviteesList from '../components/Editor/Invitees/InviteesList.vue'
import PropertySelect from '../components/Editor/Properties/PropertySelect.vue'
import PropertySelectMultiple from '../components/Editor/Properties/PropertySelectMultiple.vue'
import PropertyText from '../components/Editor/Properties/PropertyText.vue'
import PropertyTitle from '../components/Editor/Properties/PropertyTitle.vue'
import PropertyTitleTimePicker
	from '../components/Editor/Properties/PropertyTitleTimePicker.vue'
import Repeat from '../components/Editor/Repeat/Repeat.vue'
import SaveButtons from '../components/Editor/SaveButtons.vue'
import EditorMixin from '../mixins/EditorMixin.js'
import useCalendarObjectInstanceStore from '../store/calendarObjectInstance.js'
import useSettingsStore from '../store/settings.js'
import useWidgetStore from '../store/widget.js'
import { getPrefixedRoute } from '../utils/router.js'

export default {
	name: 'EditSimple',
	components: {
		NcCheckboxRadioSwitch,
		SaveButtons,
		PropertyText,
		PropertyTitleTimePicker,
		PropertyTitle,
		NcPopover,
		Actions,
		ActionButton,
		ActionLink,
		NcActionSeparator,
		AlarmList,
		Bell,
		EmptyContent,
		CalendarBlank,
		Close,
		Download,
		ContentDuplicate,
		ContentCopy,
		Delete,
		InvitationResponseButtons,
		CalendarPickerHeader,
		InviteesList,
		NcButton,
		EditIcon,
		HelpCircleIcon,
		NcDialog,
		AddTalkModal,
		NcColorPicker,
		AttachmentsList,
		PropertySelect,
		PropertySelectMultiple,
		Repeat,
		IconVideo,
	},

	mixins: [
		EditorMixin,
	],

	props: {
		dark: {
			type: Boolean,
			default: false,
		},

		lightBackdrop: {
			type: Boolean,
			default: false,
		},
	},

	data() {
		return {
			boundaryElement: null,
			isVisible: true,
			isViewing: true,
			closeMask: false,
			showCancelDialog: false,
			cancelButtons: [
				{
					label: t('calendar', 'Discard changes'),
					variant: 'secondary',
					icon: IconDelete,
					callback: () => { this.cancel(true) },
				},
				{
					label: t('calendar', 'Cancel'),
					variant: 'primary',
					icon: IconCancel,
					callback: () => { this.closeCancelDialog() },
				},
			],

			popoverStyle: {},
			popoverReady: false,
			resizeTimeout: null,
			popoverResizeObserver: null,
			lastTargetElement: null,
		}
	},

	computed: {
		...mapStores(useCalendarObjectInstanceStore),
		...mapState(useSettingsStore, ['hideEventExport']),
		...mapState(useWidgetStore, [
			'hideEventExport',
			'widgetEventDetailsOpen',
			'widgetEventDetails',
			'widgetRef',
		]),

		showPopover() {
			return this.isVisible || this.widgetEventDetailsOpen
		},

		/**
		 * Returns true if the current event is read only or the user is viewing the event
		 *
		 * @return {boolean}
		 */
		isReadOnlyOrViewing() {
			return this.isReadOnly || this.isViewing || this.isWidget
		},

		// Derived from the instance instead of flags set once per instance
		// swap: in-place edits (e.g. adding a reminder and saving) show up
		// in the viewing mode right away, without closing and reopening
		hasAttendees() {
			return Array.isArray(this.calendarObjectInstance?.attendees)
				&& this.calendarObjectInstance.attendees.length > 0
		},

		hasAlarms() {
			return Array.isArray(this.calendarObjectInstance?.alarms)
				&& this.calendarObjectInstance.alarms.length > 0
		},

		isCancelled() {
			return this.calendarObjectInstance?.status === 'CANCELLED'
		},

		/**
		 * Return the event's title or a placeholder if it is empty
		 *
		 * @return {string}
		 */
		titleOrPlaceholder() {
			if (this.title === '' && this.isReadOnlyOrViewing && !this.isLoading) {
				return t('calendar', 'Untitled event')
			}

			return this.title
		},
	},

	watch: {
		$route(to, from) {
			// Hide popover when changing the view until the user selects a slot again
			this.isVisible = to?.params.view === from?.params.view
			if (this.isVisible) {
				this.$nextTick(() => {
					this.repositionPopover()
				})
			}
		},

		showPopover(newVal) {
			if (!newVal) {
				this.popoverReady = false
			} else {
				this.$nextTick(() => {
					this.ensureElInDom()
				})
			}
		},

		calendarObjectInstance(newVal) {
			if (this.calendarObjectInstance) {
				// Reposition after content changes
				this.$nextTick(() => {
					this.repositionPopover()
				})
			}
		},

		isNew: {
			immediate: true,
			handler(isNew) {
				// New events should be editable from the start
				this.isViewing = !isNew
			},
		},

		isViewing() {
			// Hide while repositioning so the size change is not animated.
			this.popoverReady = false
			this.$nextTick(() => {
				this.repositionPopover(true)
			})
		},

		isLoading(newVal, oldVal) {
			// When loading completes, hide and reposition to fit the full content.
			if (newVal === false) {
				this.popoverReady = false
				this.$nextTick(() => {
					this.repositionPopover(true)
				})
			}
		},
	},

	async mounted() {
		this.$nextTick(() => {
			this.ensureElInDom()
		})
		if (this.isWidget) {
			const objectId = this.widgetEventDetails.object
			const recurrenceId = this.widgetEventDetails.recurrenceId
			await this.calendarObjectInstanceStore.getCalendarObjectInstanceByObjectIdAndRecurrenceId({ objectId, recurrenceId })
			this.calendarId = this.calendarObject.calendarId
			this.isLoading = false
		}
		this.boundaryElement = document.querySelector('.calendar-wrapper')
		window.addEventListener('keydown', this.keyboardCloseEditor)
		window.addEventListener('keydown', this.keyboardSaveEvent)
		window.addEventListener('keydown', this.keyboardDeleteEvent)
		window.addEventListener('keydown', this.keyboardDuplicateEvent)
		window.addEventListener('resize', this.handleResize)

		this.$nextTick(() => {
			this.repositionPopover()

			// Set up ResizeObserver to check if popover went out of bounds when content changes
			const popoverEl = this.$el.querySelector('.event-popover')
			if (popoverEl && 'ResizeObserver' in window) {
				this.popoverResizeObserver = new ResizeObserver(() => {
					// Debounce the resize events
					if (this.resizeTimeout) {
						clearTimeout(this.resizeTimeout)
					}
					// Reposition when content size changes
					this.repositionPopover(true)
				})
				this.popoverResizeObserver.observe(popoverEl)
			}
		})
	},

	updated() {
		this.ensureElInDom()
	},

	beforeUnmount() {
		window.removeEventListener('keydown', this.keyboardCloseEditor)
		window.removeEventListener('keydown', this.keyboardSaveEvent)
		window.removeEventListener('keydown', this.keyboardDeleteEvent)
		window.removeEventListener('keydown', this.keyboardDuplicateEvent)
		window.removeEventListener('resize', this.handleResize)

		// Clean up resize timeout
		if (this.resizeTimeout) {
			clearTimeout(this.resizeTimeout)
		}

		// Clean up ResizeObserver
		if (this.popoverResizeObserver) {
			this.popoverResizeObserver.disconnect()
		}
	},

	methods: {
		ensureElInDom() {
			if (!this.$el) {
				return
			}
			// Append directly to document.body so that position:fixed works relative
			// to the viewport. NcContent can have backdrop-filter applied (when a
			// background image is set), which turns it into a containing block for
			// fixed descendants and clips them via overflow:hidden — cutting off the
			// footer / save-button row.
			if (this.$el.parentElement === document.body) {
				return
			}
			document.body.appendChild(this.$el)
		},

		handleResize() {
			// Debounce resize events
			if (this.resizeTimeout) {
				clearTimeout(this.resizeTimeout)
			}
			this.resizeTimeout = setTimeout(() => {
				this.repositionPopover(true)
			}, 25)
		},

		getDomElementForPopover(isNew, route) {
			let matchingDomObject
			if (this.isWidget) {
				const objectId = this.widgetEventDetails.object
				const recurrenceId = this.widgetEventDetails.recurrenceId

				matchingDomObject = this.widgetRef.querySelector(`.fc-event[data-object-id="${objectId}"][data-recurrence-id="${recurrenceId}"]`)
			} else if (isNew) {
				matchingDomObject = document.querySelector('.fc-highlight')

				if (!matchingDomObject) {
					matchingDomObject = document.querySelector('.fc-event[data-is-new="yes"]')
				}
			} else {
				const objectId = route.params.object
				const recurrenceId = route.params.recurrenceId

				matchingDomObject = document.querySelector(`.fc-event[data-object-id="${objectId}"][data-recurrence-id="${recurrenceId}"]`)
			}

			if (!matchingDomObject) {
				matchingDomObject = document.querySelector('#app-navigation-vue')
			}

			if (!matchingDomObject) {
				matchingDomObject = document.querySelector('body')
			}

			return matchingDomObject
		},

		repositionPopover(force = false) {
			const isNew = this.isWidget ? false : this.$route.name === 'NewPopoverView'
			const targetElement = this.getDomElementForPopover(isNew, this.$route)

			if (!targetElement) {
				console.warn('[calendar] EditSimple: No target element found for popover')
				return
			}

			// Skip if target hasn't changed, unless forced
			if (!force && targetElement === this.lastTargetElement) {
				return
			}

			this.lastTargetElement = targetElement

			this.$nextTick(() => {
				this.calculateAndApplyPosition(targetElement)
			})
		},

		/**
		 * Calculate the popover position based on target element
		 */
		calculateAndApplyPosition(targetElement) {
			const SPACING = 16
			// In Vue 3, this.$el might be a comment node, so we need to check if querySelector exists
			let existingPopover = null
			if (this.$el && typeof this.$el.querySelector === 'function') {
				existingPopover = this.$el.querySelector('.event-popover')
			} else {
				// Fallback: search in the document
				existingPopover = document.querySelector('.event-popover')
			}

			const innerEl = this.$el?.querySelector?.('.event-popover__inner.edit-simple')
				?? document.querySelector('.event-popover__inner.edit-simple')

			// When repositioning while hidden, clear any stale maxHeight constraints so
			// offsetHeight reflects the natural content height, not a previous estimate.
			// Without this, the loading-spinner height locks in a maxHeight that is too
			// small for the fully loaded content, causing an unwanted scrollbar.
			if (!this.popoverReady) {
				if (existingPopover) {
					existingPopover.style.maxHeight = ''
				}
				if (innerEl) {
					innerEl.style.maxHeight = ''
				}
			}

			// Get current popover element dimensions (reading offsetHeight forces a reflow)
			const naturalHeight = existingPopover?.offsetHeight || 0
			const estimatedHeight = Math.max(naturalHeight, 200)
			const estimatedWidth = Math.max(existingPopover?.offsetWidth || 0, 460)

			// Get rectangles
			const targetRect = targetElement.getBoundingClientRect()
			const boundaryRect = this.boundaryElement?.getBoundingClientRect() || {
				top: 0,
				left: 0,
				right: window.innerWidth,
				bottom: window.innerHeight,
			}

			// Detect if target element is a fallback (body or navigation) - meaning the actual event element doesn't exist yet
			const isTargetFallback = targetElement === document.body || targetElement.id === 'app-navigation-vue'

			// Detect if target element spans most of the boundary width (like all-week or single day view events)
			const boundaryWidth = boundaryRect.right - boundaryRect.left
			const boundaryHeight = boundaryRect.bottom - boundaryRect.top
			const targetWidth = targetRect.right - targetRect.left
			const isFullWidthElement = targetWidth > boundaryWidth * 0.7

			// Calculate available space in all directions
			const spaceBelow = boundaryRect.bottom - targetRect.bottom - SPACING
			const spaceAbove = targetRect.top - boundaryRect.top - SPACING
			const spaceRight = boundaryRect.right - targetRect.right - SPACING
			const spaceLeft = targetRect.left - boundaryRect.left - SPACING

			let top = targetRect.bottom + SPACING
			let left = targetRect.left

			// If target element doesn't exist yet (fallback element), center in boundary
			if (isTargetFallback) {
				top = boundaryRect.top + (boundaryHeight - estimatedHeight) / 2
				left = boundaryRect.left + (boundaryWidth - estimatedWidth) / 2
			} else {
				// Determine best positioning strategy
				const canFitRight = spaceRight >= estimatedWidth
				const canFitLeft = spaceLeft >= estimatedWidth
				const canFitBelow = spaceBelow >= estimatedHeight
				const canFitAbove = spaceAbove >= estimatedHeight

				if (canFitRight) {
					// Position to the right
					top = targetRect.top
					left = targetRect.right + SPACING
				} else if (canFitLeft) {
					// Position to the left
					top = targetRect.top
					left = targetRect.left - estimatedWidth - SPACING
				} else if (canFitBelow) {
					// Position below
					top = targetRect.bottom + SPACING
					// If target spans full width, center popover horizontally
					left = isFullWidthElement ? boundaryRect.left + (boundaryWidth - estimatedWidth) / 2 : targetRect.left
				} else if (canFitAbove) {
					// Position above
					top = targetRect.top - estimatedHeight - SPACING
					// If target spans full width, center popover horizontally
					left = isFullWidthElement ? boundaryRect.left + (boundaryWidth - estimatedWidth) / 2 : targetRect.left
				} else {
					// Can't fit anywhere perfectly - use best available space
					if (spaceRight > spaceLeft && spaceRight > spaceBelow && spaceRight > spaceAbove) {
						top = targetRect.top
						left = targetRect.right + SPACING
					} else if (spaceLeft > spaceBelow && spaceLeft > spaceAbove) {
						top = targetRect.top
						left = targetRect.left - estimatedWidth - SPACING
					} else if (spaceBelow > spaceAbove) {
						top = targetRect.bottom + SPACING
						// If target spans full width, center popover horizontally
						left = isFullWidthElement ? boundaryRect.left + (boundaryWidth - estimatedWidth) / 2 : targetRect.left
					} else {
						top = targetRect.top - estimatedHeight - SPACING
						// If target spans full width, center popover horizontally
						left = isFullWidthElement ? boundaryRect.left + (boundaryWidth - estimatedWidth) / 2 : targetRect.left
					}
				}
			}

			// Keep horizontal position within bounds
			if (left + estimatedWidth > boundaryRect.right - SPACING) {
				left = boundaryRect.right - estimatedWidth - SPACING
			}
			if (left < boundaryRect.left + SPACING) {
				left = boundaryRect.left + SPACING
			}

			// Keep vertical position within bounds, using viewport height as the
			// hard ceiling so the popover is never positioned below the screen.
			const viewportHeight = window.innerHeight
			const effectiveBottom = Math.min(boundaryRect.bottom, viewportHeight)
			if (top + estimatedHeight > effectiveBottom - SPACING) {
				top = effectiveBottom - estimatedHeight - SPACING
			}
			if (top < boundaryRect.top + SPACING) {
				top = boundaryRect.top + SPACING
			}

			// Calculate maxHeight in pixels so it is consistent with the JS
			// coordinate system. Leave SPACING clearance at the bottom so the
			// footer/save-button row is never flush against the viewport edge.
			const maxH = Math.max(
				Math.min(Math.floor(viewportHeight * 0.9), viewportHeight - top - SPACING),
				200, // absolute minimum so loading spinner is still visible
			)

			// Apply the full style (position + size) while the popover is hidden.
			this.popoverStyle = {
				position: 'fixed',
				top: `${top}px`,
				left: `${left}px`,
				zIndex: 9999,
				// Fits small phone viewports (360px and up); the CSS caps the regular width
				maxWidth: 'calc(100vw - 32px)',
				maxHeight: `${maxH}px`,
			}

			// Always set the inner's maxHeight to the available viewport space.
			// When content is shorter it has no effect (inner renders at natural height,
			// no scrollbar). When the user later expands content (adds attendees, toggles
			// all-day, etc.) the flex layout kicks in: the scrollable content area grows
			// while the footer stays anchored at the bottom.
			if (innerEl) {
				innerEl.style.maxHeight = `${maxH}px`
			}

			// Show the popover only after the final layout is committed.
			setTimeout(() => {
				this.popoverReady = true
			}, 25)
		},

		/**
		 * Save changes and leave when creating a new event or return to viewing mode when editing
		 * an existing event. Stay in editing mode if an error occurrs.
		 *
		 * @param {boolean} thisAndAllFuture Modify this and all future events
		 * @return {Promise<void>}
		 */
		async saveAndView(thisAndAllFuture) {
			// Transitioning from new to edit routes is not implemented for now
			if (this.isNew) {
				await this.saveAndLeave(thisAndAllFuture)
				return
			}

			this.isViewing = true
			try {
				await this.save(thisAndAllFuture)
				this.requiresActionOnRouteLeave = false
			} catch (error) {
				this.isViewing = false
			}
		},

		/**
		 * Toggles the all-day state of an event
		 */
		toggleAllDayPreliminary() {
			if (!this.canModifyAllDay) {
				return
			}

			this.toggleAllDay()
		},
	},
}
</script>

<style lang="scss" scoped>
.modal-mask {
	position: fixed;
	z-index: 9998;
	//the height of header
	top: 50px;
	inset-inline-start: 0;
	display: block;
	width: 100%;
	height: 100%;
	--backdrop-color: 0, 0, 0;
	background-color: rgba(var(--backdrop-color), .5);
	&--opaque {
		background-color: rgba(var(--backdrop-color), .92);
	}
	&--light {
		--backdrop-color: 255, 255, 255;
	}
}

.cancel-confirmation-dialog {
	z-index: 1000000 !important;
}

.event-popover {
	position: fixed;
	width: calc(var(--default-grid-baseline) * 130);
	// Never wider than small phone viewports (360px and up) allow
	max-width: min(calc(var(--default-grid-baseline) * 130), calc(100vw - var(--default-grid-baseline) * 8));
	max-height: 90vh;
	overflow: hidden;
	background: var(--color-main-background);
	box-shadow: 0 4px 20px rgba(0, 0, 0, .8);
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-large);
}

.event-popover .event-popover__inner {
	display: flex;
	flex-direction: column;
	max-height: 90vh;
	box-sizing: border-box;
	padding-inline-start: calc(var(--default-grid-baseline) * 4);
	padding-inline-end: calc(var(--default-grid-baseline) * 2);
	padding-top: calc(var(--default-grid-baseline) * 2);
	padding-bottom: calc(var(--default-grid-baseline) * 2);

	.empty-content {
		margin-top: 0 !important;
		padding: calc(var(--default-grid-baseline) * 12);
	}

	.event-popover__header {
		flex-shrink: 0;
		padding-inline-end: calc(var(--default-grid-baseline) * 4);
		padding-bottom: calc(var(--default-grid-baseline) * 2);
		background: var(--color-main-background);

		:deep(.calendar-picker-header) {
			margin-inline-start: 0;
			margin-bottom: calc(var(--default-grid-baseline) * 2);
		}

		.event-popover__cancelled {
			opacity: .7;
		}
	}

	.event-popover__content {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: calc(var(--default-grid-baseline) * 4);
		padding-inline-end: calc(var(--default-grid-baseline) * 4);
		overflow-y: auto;
		overflow-x: hidden;
		min-height: 0;

		:deep(.property-title-time-picker__time-pickers-from) {
			margin-inline-start: calc(var(--default-grid-baseline) * 3);
			padding-inline-end: calc(var(--default-grid-baseline) * 3);
		}

		:deep(.property-title-time-picker__time-pickers-to) {
			margin-inline-start: calc(var(--default-grid-baseline) * 3);
			padding-inline-end: calc(var(--default-grid-baseline) * 3);
		}

		// All fields share one content column: the date-picker labels get a
		// fixed width, so the pickers line up with the location, description
		// and attendees fields (which indent by 13 grid units, see
		// PropertyText and the invitees rule below)
		:deep(.datepicker-label) {
			flex: 0 0 20px;
			margin-inline-start: calc(var(--default-grid-baseline) * -1);
			margin-inline-end: calc(var(--default-grid-baseline) * 2);
			color: var(--color-main-text);
		}

		// The selects, the recurrence summary, the reminders and the
		// attachments share the same content column as the text fields;
		// the select icons sit in the flex flow, so the column is set via
		// their end margin
		:deep(.property-select__icon),
		:deep(.property-select-multiple__icon) {
			// The icon containers span a full clickable area by default;
			// shrunk, the fields sit as close to their icons as the icons
			// sit to the edge
			flex: 0 0 20px !important;
			width: 20px !important;
			min-width: 0 !important;
			// The component's own flex gap provides the spacing
			margin-inline-end: 0 !important;
		}

		:deep(.property-select__input),
		:deep(.property-select-multiple__input) {
			width: auto;
			flex: 1;
			min-width: 0;
		}

		// The recurrence summary is plain text, not a field: it sits on the
		// content column like the read-only values, not on the inner text
		// line of the boxed fields
		:deep(.property-repeat__summary__content) {
			margin-inline-start: 0;
		}

		:deep(.property-alarm-list) {
			flex: 1;
			// Without this the list refuses to go below its content width
			// (the automatic flex minimum) and the reminder rows below never
			// experience the pressure that makes their selects share the
			// remaining space - the rows then leak past the field column
			min-width: 0;
			// The components carry no outer margins (see global.scss), so
			// the layout provides the spacing between the reminder rows
			display: flex;
			flex-direction: column;
			gap: calc(var(--default-grid-baseline) * 2);
		}

		:deep(.property-alarm-list .v-select) {
			width: 100%;
		}

		:deep(.attachments-summary-inner-label) {
			// Plain label without a box: it sits on the content column like
			// the recurrence summary (the component wraps the icon in inner
			// margins, hence the correction)
			margin-inline-start: calc(var(--default-grid-baseline) * 5 - 9px - 14px);

			h3 {
				font-weight: normal;
			}
		}

		// Attached files line up with the field frames instead of hanging
		// under the icon column (the item's own 8px inner padding is part
		// of the offset)
		:deep(.attachments-list) {
			margin-inline: calc(var(--default-grid-baseline) * 9 - 8px) 0;
		}

		// One text line for every field: the select internals are aligned
		// app-wide in global.scss; the status chips render inside
		// vs__selected, so their line offset comes from there

		// The calendar glyphs inside the date/time inputs and the globe of
		// the timezone button share the same line
		:deep(.property-title-time-picker__time-pickers-from-inner__selectors svg) {
			margin-inline-start: 14px;
		}

		// Read-only rows center their icon on the value text, which sits
		// right next to the icon instead of out on the field column
		:deep(.property-select--readonly),
		:deep(.property-select--readonly .property-select__input) {
			display: flex;
			align-items: center;
			gap: calc(var(--default-grid-baseline) * 2) !important;
		}

		:deep(.property-select--readonly .property-select__icon) {
			// The icon container is a full clickable area wide; shrink it to
			// the glyph so the value sits right next to it
			width: 20px !important;
			margin-inline-end: calc(var(--default-grid-baseline) * 2) !important;
		}

		&--viewing :deep(.property-title-time-picker-read-only-wrapper__label) {
			margin-inline-start: 0;
			padding-inline-start: 0;
		}

		// In the viewing mode the description is plain text, not a field;
		// space runs collapse, so wrapped lines never start with blanks
		&--viewing :deep(.property-text__readonly-value) {
			border: none;
			padding: 0;
			margin-bottom: 0;
			white-space: pre-line;
		}

		:deep(.property-select--readonly .property-select__input) {
			padding-inline-start: 0 !important;

			> * {
				margin-inline-start: 0 !important;
				padding-inline-start: 0 !important;
			}
		}

		// Existing reminders line up on the field column, their menus at
		// the far end
		:deep(.property-alarm-item) {
			display: flex;
			align-items: center;
			justify-content: space-between;
		}

		// The inline alarm editor (amount, unit, time) shares the column of
		// the other fields
		// The inline alarm editor expands in the flow (it is absolutely
		// positioned for the full editor and overlapped the rows below).
		// Field width design, like everywhere in the editor: a row of
		// fields spans the full content column, ending on the same edge as
		// every other field; several fields in one row share it equally
		// (the pattern of the date/time halves)
		:deep(.property-alarm-item__edit) {
			position: static !important;
			margin-inline-start: calc(var(--default-grid-baseline) * 9);
			width: auto !important;
			flex: 1 1 auto;
			min-width: 0;
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: calc(var(--default-grid-baseline) * 2);

			> * {
				flex: 1 1 0;
				min-width: 0;
			}
		}

		// These selects sit on the same 14px text line as every other
		// field (the inset is inherited from global.scss, not trimmed
		// here) so their value lines up with the fields above and with
		// their own dropdown options. When a select's share is truly too
		// small the value ellipsizes gracefully instead of pushing out.
		:deep(.property-alarm-item__edit .v-select.select:not(.vs--multiple) .vs__selected) {
			flex: 0 1 auto;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		:deep(.property-alarm-item__edit .v-select.select .vs__search) {
			// ... which in turn must not grow into the value's space - it
			// keeps an intrinsic width even when empty, so it is pinned to
			// a caret-thin sliver in both states (two options need no
			// type-ahead, and the box must not change width on opening)
			flex: 0 0 auto !important;
			width: 2px !important;
			min-width: 0 !important;
			padding: 0 !important;
			margin-inline: 0 !important;
		}

		:deep(.property-alarm-item__edit .v-select.select .vs__actions) {
			padding-inline: 0 2px;
			// The library reserves room for a clear button that never
			// renders here; without a floor the chevron column takes just
			// its rendered width
			flex: 0 0 auto;
			min-width: 0;
		}

		:deep(.property-alarm-item__edit .v-select.select .vs__selected-options) {
			// The value carries its own text-line margin; the container's
			// padding would only eat into the readable width. Grown from
			// zero it takes everything the chevron leaves - the phantom
			// minimum of the actions column stops shrinking it otherwise
			flex: 1 1 0;
			min-width: 0;
			padding-inline: 0 !important;
		}

		:deep(.property-alarm-item__edit input[type='time']) {
			padding-inline: calc(var(--default-grid-baseline));
		}

		// While open, vue-select floats the value out of the layout, which
		// collapsed these width-by-value selects to their tiny search
		// field and let the dropdown panel overhang. The value stays in
		// the flow instead, so the box keeps its width in both states,
		// and the panel follows the box
		:deep(.property-alarm-item__edit .v-select.select.vs--open .vs__selected) {
			position: static !important;
			opacity: .6;
		}

		// The compact amount fields hold three digits; the browser's
		// spinner would eat exactly that space
		:deep(.property-alarm-item__edit input[type='number']) {
			appearance: textfield;

			&::-webkit-inner-spin-button,
			&::-webkit-outer-spin-button {
				appearance: none;
				margin: 0;
			}
		}

		// One line, always, flush on both edges - by construction, for
		// the timed and the all-day editor alike: the amount is
		// font-scaled (em), the time keeps its natural width, and the
		// selects (unit, direction) share whatever remains equally,
		// growing and shrinking so the line ends exactly on the actions
		// column on every density. The groups leave the layout entirely.
		:deep(.property-alarm-item__edit--all-day__distance),
		:deep(.property-alarm-item__edit--all-day__time) {
			display: contents;
		}

		:deep(.property-alarm-item__edit--timed),
		:deep(.property-alarm-item__edit--all-day) {
			flex-wrap: nowrap;
			gap: var(--default-grid-baseline);
		}

		:deep(.property-alarm-item__edit .input-field) {
			// Three digits at any font size (the spinner is hidden)
			flex: 0 0 4.5em;
		}

		:deep(.property-alarm-item__edit .v-select.select) {
			// Their own value width is the base of the distribution, so the
			// surplus lands on top of readable values (and the dropdown,
			// which follows the box width, fits its options); only when the
			// line is truly short do they shrink and ellipsize
			flex: 1 1 auto;
			min-width: 0;
			width: auto;
		}

		:deep(.property-alarm-item__edit .native-datetime-picker) {
			flex: 0 0 auto;
			min-width: max-content;
		}

		:deep(.property-alarm-item__front) {
			// Lines up with the preview text inside the selects
			margin-inline-start: calc(var(--default-grid-baseline) * 9 + 14px) !important;
		}

		// In the viewing mode the bell icon fills the label column, so the
		// alarm text needs only the remaining gap to sit on the field line
		// (this rule must follow the editing rule above - same specificity)
		&--viewing :deep(.property-alarm-item__front) {
			margin-inline-start: calc(var(--default-grid-baseline) * 4) !important;
		}

		// The date and the time picker share the row in two equal halves,
		// and the footer row below mirrors exactly these halves: the
		// timezone lands under the date column, the all-day toggle under
		// the time column - robust against density and font differences,
		// unlike fixed pixel offsets
		:deep(.property-title-time-picker__time-pickers-from-inner__selectors > *) {
			flex: 1 1 0;
			width: auto;
			min-width: 0;
		}

		:deep(.property-title-time-picker__time-pickers-from-inner__selectors .mx-datepicker) {
			width: 100%;
		}

		:deep(.property-title-time-picker__footer-row) {
			margin-inline-start: calc(var(--default-grid-baseline) * 9);
			position: relative;
			min-height: calc(var(--default-clickable-area) + var(--default-grid-baseline) * 2);
		}

		// The globe starts at the column like the calendar glyph inside the
		// date input (the button's icon slot centers the icon on the
		// clickable area, which matches the glyph inset of the input)
		:deep(.property-title-time-picker__footer-row > .button-vue) {
			margin-inline-start: 0;
			padding-inline-start: var(--default-grid-baseline);
		}

		// The all-day toggle is anchored to the second (time) column, which
		// starts exactly at half the row now that both pickers share it
		// equally; without times (all-day events) it moves to the first
		// (date) column. Its internal paddings are stripped, so the box
		// itself sits on the column.
		.event-popover__all-day {
			position: absolute;
			top: 0;
			// Plus the glyph inset inside the input (its inline padding)
			inset-inline-start: calc(50% + var(--default-grid-baseline) / 2 + var(--default-grid-baseline) * 3);

			&--all-day {
				inset-inline-start: calc(var(--default-grid-baseline) * 2);
			}

			:deep(.checkbox-radio-switch__content) {
				padding-inline-start: 0;
			}

			// The box center already sits under the clock glyph of the time
			// input; its container is 3px wider than the input's text inset,
			// so the label is pulled onto the time text line
			:deep(.checkbox-content__icon) {
				margin-inline-end: -3px;
			}
		}

	}

	.event-popover__footer {
		flex-shrink: 0;
		padding-top: calc(var(--default-grid-baseline) * 2);
		background: var(--color-main-background);
	}

	.event-popover__loading-icon {
		margin-block: calc(var(--default-grid-baseline) * 10);
	}

	.event-popover__top-actions {
		display: flex;
		align-items: center;
		gap: var(--default-grid-baseline);
		position: absolute !important;
		top: var(--default-grid-baseline) !important;
		z-index: 100 !important;
		inset-inline-end : var(--default-grid-baseline) !important;
		.action-item.action-item--single {
			width: 44px !important;
			height: 44px !important;
		}

		// Only the action buttons are dimmed; the color dot must show the
		// real calendar color
		.action-item {
			opacity: .7;
		}
	}
}

.property-alarm-wrapper {
	display: flex;
	align-items: center;

}

.event-popover__status-row {
	display: flex;

	// The second select keeps its icon visibly next to its own field: the
	// row gap stays wider than the icon's own gap
	gap: calc(var(--default-grid-baseline) * 4);

	> * {
		flex: 1 1 0;
		min-width: 0;
	}

	> *:last-child :deep(.property-select__icon) {
		margin-inline-end: calc(var(--default-grid-baseline) * 2);
	}

	:deep(.v-select) {
		min-width: 0 !important;
		width: 100%;
	}
}

.event-popover__color-dot {
	appearance: none;
	width: 24px;
	height: 24px;
	min-width: 24px;
	min-height: 24px !important;
	padding: 0;
	border: none;
	border-radius: 50%;
	cursor: pointer;
}

.event-popover__description-row {
	position: relative;

	// The textarea pulls following content up by a negative bottom margin
	// (see PropertyText) and leaves inline baseline space below itself;
	// neutralize both so the row ends flush with the visible field and
	// the Talk button can anchor to its bottom edge
	:deep(textarea) {
		display: block;
		margin-bottom: 0 !important;
	}

	// The Talk button sits in the otherwise unused icon column, flush with
	// the bottom edge of the description field
	.event-popover__talk-button {
		position: absolute;
		bottom: 0;
		inset-inline-start: 0;
		// Compact, so it stays clear of the field next to it
		min-width: 0 !important;
		min-height: 0 !important;
		width: calc(var(--default-grid-baseline) * 7) !important;
		height: calc(var(--default-grid-baseline) * 7) !important;
	}
}

</style>
