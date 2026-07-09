<!--
  - SPDX-FileCopyrightText: 2019 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div
		v-if="display"
		class="property-text"
		:class="{ 'property-text--readonly': isReadOnly }">
		<component
			:is="icon"
			:title="info"
			:size="20"
			:name="readableName"
			class="property-text__icon"
			:class="{ 'property-text__icon--hidden': !showIcon }" />

		<div
			class="property-text__input"
			:class="{ 'property-text__input--readonly': isReadOnly, 'property-text__input--linkify': showLinksClickable }">
			<textarea
				v-if="!isReadOnly && !showLinksClickable"
				v-autosize="true"
				:aria-label="readableName"
				:placeholder="placeholder"
				:rows="rows"
				:name="readableName"
				:value="value"
				:class="{ 'textarea--description': isDescription }"
				@focus="handleToggleTextareaFocus(true)"
				@blur="handleToggleTextareaFocus(false)"
				@input.prevent.stop="changeValue" />
			<!-- eslint-disable-next-line vue/singleline-html-element-content-newline -->
			<div
				v-else
				v-linkify="{ text: displayValue, linkify: true }"
				class="property-text__readonly-value"
				:class="{ 'linkify-links': linkifyLinks && !isReadOnly }"
				:style="{ 'min-height': linkifyMinHeight }"
				@click="handleShowTextarea" />
		</div>
	</div>
</template>

<script>
import { Linkify } from '@nextcloud/vue'
import InformationVariant from 'vue-material-design-icons/InformationVariant.vue'
import autosize from '../../../directives/autosize.js'
import PropertyLinksMixin from '../../../mixins/PropertyLinksMixin.js'
import PropertyMixin from '../../../mixins/PropertyMixin.js'

export default {
	name: 'PropertyText',
	directives: {
		autosize,
		Linkify,
		InformationVariant,
	},

	mixins: [
		PropertyMixin,
		PropertyLinksMixin,
	],

	props: {
		isDescription: {
			type: Boolean,
			default: false,
		},
	},

	computed: {
		/**
		 * The read-only rendering collapses non-breaking spaces: they do
		 * not vanish at wrap points and would indent the wrapped lines
		 *
		 * @return {string}
		 */
		displayValue() {
			return typeof this.value === 'string' ? this.value.replace(/\u00a0/g, ' ') : this.value
		},

		display() {
			if (this.isReadOnly) {
				if (typeof this.value !== 'string') {
					return false
				}
				if (this.value.trim() === '') {
					return false
				}
			}

			return true
		},

		/**
		 * Returns the default number of rows for a textarea, taken from the
		 * property model; the textarea keeps growing with its content.
		 *
		 * @return {number}
		 */
		rows() {
			return this.propModel.defaultNumberOfRows || 1
		},
	},

	methods: {
		changeValue(event) {
			if (event.target.value.trim() === '') {
				this.$emit('update:value', null)
			} else {
				this.$emit('update:value', event.target.value)
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.property-text {
	position: relative;
}

.property-text__icon {
	position: absolute;
	top: calc(var(--default-grid-baseline) * 1);
}

.property-text__input {
	padding-inline-start: calc(var(--default-grid-baseline) * 9);
}

.edit-simple .property-text__input {
	// Same content column as the date pickers of the simple editor: the
	// fields sit as close to their icons as the icons sit to the edge
	padding-inline-start: calc(var(--default-grid-baseline) * 9);
}

.property-text--readonly .property-text__input {
	padding-inline-start: calc(var(--default-grid-baseline) * 9);
}

.property-text__readonly-value {
	white-space: pre-wrap;
	overflow-wrap: break-word;
	// Mirrors the textarea's box (border + padding), so toggling between
	// the clickable-links view and the editable textarea does not jump;
	// the border color matches the textarea's, so the field keeps its
	// visible frame while the links are clickable
	border: 2px solid var(--color-border-maxcontrast);
	padding: 5px 12px;
	margin-bottom: -8px;

	// The server styles external links with 3px side margins; a wrapped
	// line starting with a link would be indented by them
	:deep(a) {
		margin-inline: 0;
	}
}

textarea {
	margin: 0 !important;
	margin-bottom: -8px !important;
	resize: none;
}
</style>
