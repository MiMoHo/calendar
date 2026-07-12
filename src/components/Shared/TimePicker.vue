<!--
  - SPDX-FileCopyrightText: 2019 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<DateTimePicker
		:modelValue="displayDate"
		type="time"
		:hideLabel="true"
		v-bind="$attrs"
		@update:modelValue="change" />
</template>

<script>
import { NcDateTimePickerNative as DateTimePicker } from '@nextcloud/vue'
import { mapState } from 'pinia'
import useSettingsStore from '../../store/settings.js'

export default {
	name: 'TimePicker',
	components: {
		DateTimePicker,
	},

	props: {
		date: {
			type: Date,
			required: true,
		},
	},

	data() {
		return {
			// The native input emits on every keystroke and reports null
			// while the typed time is still incomplete. Feeding the model
			// straight back into the input would rewrite it mid-typing and
			// throw the entered segments away, so the shown value is
			// decoupled: it only follows the prop when the change really
			// came from outside
			displayDate: this.date,
			lastEmitted: this.date,
		}
	},

	computed: {
		...mapState(useSettingsStore, {
			locale: 'momentLocale',
		}),
	},

	watch: {
		date(newDate) {
			if (!newDate || +newDate === +this.lastEmitted) {
				return
			}

			this.displayDate = newDate
			this.lastEmitted = newDate
		},
	},

	methods: {
		/**
		 * Emits a change event for the Date
		 *
		 * @param {?Date} date The new Date object, null while the typed
		 * time is still incomplete
		 */
		change(date) {
			if (!date || isNaN(date.getTime())) {
				return
			}

			this.lastEmitted = date
			this.$emit('change', date)
		},
	},
}
</script>
