<!--
  - SPDX-FileCopyrightText: 2019 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div
		v-if="display"
		class="property-select"
		:class="{ 'property-select--readonly': isReadOnly }">
		<component
			:is="icon"
			:title="info"
			:size="20"
			:name="readableName"
			class="property-select__icon"
			:class="{ 'property-select__icon--hidden': !showIcon }" />

		<div
			class="property-select__input"
			:class="{ 'property-select__input--readonly': isReadOnly }">
			<NcSelect
				v-if="!isReadOnly"
				v-model="selectedValue"
				:options="options"
				:searchable="false"
				:name="readableName"
				:placeholder="placeholder"
				:clearable="false"
				:inputId="readableName + '-select-input'"
				:ariaLabelCombobox="readableName"
				:ariaLabelListbox="readableName"
				label="label">
				<template #option="option">
					<span :class="optionClasses(option)">{{ option.label }}</span>
				</template>
				<template #selected-option="option">
					<span :class="optionClasses(option)">{{ option.label }}</span>
				</template>
			</NcSelect>
			<div v-else>
				<span :class="optionClasses(selectedValue)">{{ selectedValue.label }}</span>
			</div>
		</div>
	</div>
</template>

<script>
import { NcSelect } from '@nextcloud/vue'
import InformationVariant from 'vue-material-design-icons/InformationVariant.vue'
import PropertyMixin from '../../../mixins/PropertyMixin.js'

export default {
	name: 'PropertySelect',
	components: {
		NcSelect,
		InformationVariant,
	},

	mixins: [
		PropertyMixin,
	],

	computed: {
		display() {
			return true
		},

		options() {
			return this.propModel.options
		},

		selectedValue: {
			get() {
				const value = this.value || this.propModel.defaultValue
				return this.options.find((option) => option.value === value)
			},

			set(selectedOption) {
				if (!selectedOption) {
					return
				}

				this.$emit('update:value', selectedOption.value)
			},
		},
	},

	methods: {
		/**
		 * Classes rendering an option in the same formatting the event legend
		 * uses for the corresponding state in the calendar grid.
		 *
		 * @param {object|undefined} option The select option
		 * @return {string[]} The class list for the option
		 */
		optionClasses(option) {
			if (!option?.styleClass) {
				return []
			}
			return ['property-select__option', `property-select__option--${option.styleClass}`]
		},
	},
}
</script>

<style lang="scss" scoped>

.property-select {
	&__input {
		// 34px left and right need to be subtracted. See https://github.com/nextcloud/calendar/pull/3361
		width: calc(100% - 34px - 34px);

		// Long selected options may wrap; a compact line height keeps the
		// two lines within the select frame
		:deep(.vs__selected) {
			line-height: 1.15;
			white-space: normal;
		}
	}
}

// Mirrors the formatting of the calendar grid and the event legend: the
// vertical bar on the left in the color of the selected calendar (or the
// custom event color), bold for confirmed, bold italic for tentative,
// struck through for canceled events.
.property-select__option {
	display: inline-block;
	padding-inline: var(--default-grid-baseline);
	border-inline-start: calc(var(--default-grid-baseline) * 2) solid var(--nc-editor-calendar-color, var(--color-primary-element));
	font-weight: normal;

	&--confirmed {
		font-weight: bold;
	}

	&--tentative {
		font-weight: bold;
		font-style: italic;
	}

	&--cancelled {
		text-decoration: line-through;
	}
}
</style>
