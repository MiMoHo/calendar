<!--
  - SPDX-FileCopyrightText: 2019 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div class="avatar-participation-status">
		<Avatar v-if="isGroup">
			<template #icon>
				<AccountMultiple :size="28" />
			</template>
		</Avatar>
		<Avatar
			v-else
			:disableTooltip="true"
			:user="commonName"
			:displayName="commonName"
			:isNoUser="true" />
		<template v-if="!isGroup">
			<component
				:is="status.icon"
				class="avatar-participation-status__indicator"
				:fillColor="status.fillColor"
				:size="20" />
			<div class="avatar-participation-status__text">
				<span v-if="adjustedTime" class="avatar-participation-status__text__time">{{ adjustedTime }} local time, </span>{{ statusText }}
			</div>
		</template>
	</div>
</template>

<script>
import { NcAvatar as Avatar } from '@nextcloud/vue'
import { mapStores } from 'pinia'
import AccountMultiple from 'vue-material-design-icons/AccountMultipleOutline.vue'
import IconDelegated from 'vue-material-design-icons/ArrowRightDropCircleOutline.vue'
import IconAccepted from 'vue-material-design-icons/CheckCircleOutline.vue'
import IconDeclined from 'vue-material-design-icons/CloseCircleOutline.vue'
import IconTentative from 'vue-material-design-icons/HelpCircleOutline.vue'
import IconNoResponse from 'vue-material-design-icons/MinusCircleOutline.vue'
import useCalendarObjectInstanceStore from '../../store/calendarObjectInstance.js'
import { adjustAttendeeTime } from '@/services/attendeeDetails'

export default {
	name: 'AvatarParticipationStatus',
	components: {
		Avatar,
		AccountMultiple,
		IconAccepted,
		IconTentative,
		IconNoResponse,
		IconDeclined,
		IconDelegated,
	},

	props: {
		avatarLink: {
			type: String,
			required: true,
		},

		participationStatus: {
			type: String,
			required: true,
		},

		scheduleStatus: {
			type: String,
			required: false,
		},

		commonName: {
			type: String,
			required: true,
		},

		isViewedByOrganizer: {
			type: Boolean,
			required: true,
		},

		isResource: {
			type: Boolean,
			required: true,
		},

		isGroup: {
			type: Boolean,
			required: false,
		},

		isSuggestion: {
			type: Boolean,
			default: false,
		},

		attendeeIsOrganizer: {
			type: Boolean,
			required: true,
		},

		organizerDisplayName: {
			type: String,
			required: true,
		},

		timezone: {
			type: String,
			required: false,
			default: null,
		},

		role: {
			type: String,
			required: false,
			default: null,
		},

		rsvp: {
			// Boolean, or null when the reply request state is unknown
			validator: (value) => typeof value === 'boolean' || value === null,
			required: false,
			default: null,
		},
	},

	computed: {
		...mapStores(useCalendarObjectInstanceStore),
		/**
		 * @return {icon: object, fillColor: string|undefined, text: string}
		 */
		status() {
			const acceptedIcon = {
				icon: IconAccepted,
				fillColor: 'var(--color-success-text)',
			}
			const declinedIcon = {
				icon: IconDeclined,
				fillColor: 'var(--color-error-text)',
			}
			const tentativeIcon = {
				icon: IconTentative,
				fillColor: 'var(--color-element-warning)',
			}
			const delegatedIcon = {
				icon: IconDelegated,
				fillColor: 'vat(--color-text-maxcontrast)',
			}
			const noResponseIcon = {
				icon: IconNoResponse,
				fillColor: 'vat(--color-text-maxcontrast)',
			}

			if (this.isSuggestion) {
				return {
					...acceptedIcon,
					text: t('calendar', 'Suggested'),
				}
			}

			// Try to use the participation status first
			switch (this.participationStatus) {
				case 'ACCEPTED':
					if (this.isResource) {
						return {
							...acceptedIcon,
							text: t('calendar', 'Available'),
						}
					}

					if (this.attendeeIsOrganizer) {
						// The organizer was never invited; saying so confuses
						return {
							...acceptedIcon,
							text: t('calendar', 'Organizer of the event'),
						}
					}

					return {
						...acceptedIcon,
						text: t('calendar', 'Accepted {organizerName}\'s invitation', {
							organizerName: this.organizerDisplayName,
						}),
					}
				case 'TENTATIVE':
					return {
						...tentativeIcon,
						text: t('calendar', 'Participation marked as tentative'),
					}
				case 'DELEGATED':
					return {
						icon: IconDelegated,
						text: t('calendar', 'Invitation is delegated'),
					}
				case 'DECLINED':
					if (this.isResource) {
						return {
							...declinedIcon,
							text: t('calendar', 'Not available'),
						}
					}

					if (this.isViewedByOrganizer) {
						return {
							...declinedIcon,
							text: t('calendar', 'Invitation declined'),
						}
					}

					return {
						...declinedIcon,
						text: t('calendar', 'Declined {organizerName}\'s invitation', {
							organizerName: this.organizerDisplayName,
						}),
					}
			}

			// Schedule status is only present on the original event of the organizer
			// TODO: Is this a bug or compliant with RFCs?
			if (this.isViewedByOrganizer) {
				// No status or status 1.0 indicate that the invitation is pending
				if (!this.scheduleStatus || this.scheduleStatus === '1.0') {
					if (this.isResource) {
						return {
							icon: IconNoResponse,
							text: t('calendar', 'Availability will be checked'),
						}
					}

					return {
						icon: IconNoResponse,
						text: t('calendar', 'Invitation will be sent'),
					}
				}

				// Status 3.7, 3.8, 5.1, 5.2 and 5.3 indicate delivery failures.
				// Could be due to insufficient permissions or some temporary failure.
				if (this.scheduleStatus[0] === '3' || this.scheduleStatus[0] === '5') {
					if (this.isResource) {
						return {
							icon: IconNoResponse,
							text: t('calendar', 'Failed to check availability'),
						}
					}

					return {
						icon: IconNoResponse,
						text: t('calendar', 'Failed to deliver invitation'),
					}
				}

				return {
					icon: IconNoResponse,
					text: t('calendar', 'Awaiting response'),
				}
			}

			if (this.isResource) {
				return {
					icon: IconNoResponse,
					text: t('calendar', 'Checking availability'),
				}
			}

			return {
				icon: IconNoResponse,
				text: t('calendar', 'Has not responded to {organizerName}\'s invitation yet', {
					organizerName: this.organizerDisplayName,
				}),
			}
		},

		adjustedTime() {
			return adjustAttendeeTime(this.calendarObjectInstanceStore.calendarObjectInstance.startDate, this.timezone)
		},

		/**
		 * The status text with the participation type appended
		 *
		 * @return {string}
		 */
		statusText() {
			const text = this.status.text.trim()
			if (!this.participationType) {
				return text
			}

			return `${text}: ${this.participationType}`
		},

		/**
		 * The participation type set through the three-dot menu (role and
		 * whether a reply was requested), shown after the status so the
		 * invitation kind is visible at a glance
		 *
		 * @return {?string}
		 */
		participationType() {
			if (this.isGroup || this.isResource || this.attendeeIsOrganizer || this.isSuggestion) {
				return null
			}

			const roleLabels = {
				CHAIR: t('calendar', 'Chairperson'),
				'REQ-PARTICIPANT': t('calendar', 'Required participant'),
				'OPT-PARTICIPANT': t('calendar', 'Optional participant'),
				'NON-PARTICIPANT': t('calendar', 'Non-participant'),
			}
			const roleLabel = roleLabels[this.role]
			if (!roleLabel) {
				return null
			}

			if (this.rsvp === null) {
				return roleLabel
			}

			return this.rsvp
				? t('calendar', '{role} with reply', { role: roleLabel })
				: t('calendar', '{role} without reply', { role: roleLabel })
		},
	},
}
</script>

<style lang="scss" scoped>
.avatar-participation-status {
	position: relative;
	height: 38px;
	// The avatar acts as the row's icon: it starts on the icon column and
	// this width puts the name right on the content column of the editor
	width: 36px;

	&__indicator {
		position: absolute;
		bottom: 2px !important;
		// Badge on the avatar's end corner instead of floating beside it
		inset-inline-start: 20px;
		inset-inline-end: 0;
		background-size: 10px;
		height: 15px;
		width: 15px;
		border-radius: 50%;
		opacity: .8;
		justify-self: unset !important;
	}

	&__text {
		color: var(--color-text-maxcontrast);
		// The status sits on the content column, like the name above it
		inset-inline-start: 36px;
		bottom: 21px;
		white-space: nowrap;
		position: relative;
		text-overflow: ellipsis;
		overflow: hidden;
		max-width: 420px;
		min-width: 420px;
	}
}
</style>
