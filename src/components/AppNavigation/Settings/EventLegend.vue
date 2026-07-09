<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<template>
	<NcAppSettingsSection
		id="settings-modal-legend"
		:name="t('calendar', 'Event legend')">
		<p class="event-legend__intro">
			{{ t('calendar', 'Calendar events are styled to convey additional information at a glance.') }}
		</p>

		<!-- Participation status -->
		<h3 class="event-legend__heading">
			{{ t('calendar', 'Participation status') }}
		</h3>
		<ul class="event-legend__list">
			<li class="event-legend__item">
				<div class="event-legend__demo event-legend__demo--accepted">
					<span class="event-legend__demo-title">{{ t('calendar', 'Confirmed') }}</span>
				</div>
				<span class="event-legend__label">{{ t('calendar', 'Confirmed: events taking place are shown in bold') }}</span>
			</li>
			<li class="event-legend__item">
				<div class="event-legend__demo event-legend__demo--tentative">
					<span class="event-legend__demo-title event-legend__demo-title--italic">{{ t('calendar', 'Tentative') }}</span>
				</div>
				<span class="event-legend__label">{{ t('calendar', 'Tentative: your participation is uncertain') }}</span>
			</li>
			<li class="event-legend__item">
				<div class="event-legend__demo event-legend__demo--needs-action">
					<span class="event-legend__demo-title event-legend__demo-title--regular">{{ t('calendar', 'Invited') }}</span>
				</div>
				<span class="event-legend__label">{{ t('calendar', 'Invited: you have not yet responded to this invitation') }}</span>
			</li>
			<li class="event-legend__item">
				<div class="event-legend__demo event-legend__demo--declined">
					<span class="event-legend__demo-title event-legend__demo-title--regular event-legend__demo-title--strikethrough">{{ t('calendar', 'Declined') }}</span>
				</div>
				<span class="event-legend__label">{{ t('calendar', 'Declined: you declined this event') }}</span>
			</li>
			<li class="event-legend__item">
				<div class="event-legend__demo event-legend__demo--all-declined">
					<span class="event-legend__demo-title event-legend__demo-title--regular event-legend__demo-title--strikethrough">
						<!-- Warning triangle (Material Symbols) -->
						<svg class="event-legend__icon" viewBox="0 -960 960 960" aria-hidden="true">
							<path d="m40-120 440-760 440 760H40Zm440-120q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm-40-120h80v-200h-80v200Z" />
						</svg>
						{{ t('calendar', 'All declined') }}
					</span>
				</div>
				<span class="event-legend__label">{{ t('calendar', 'All declined: all participants declined') }}</span>
			</li>
		</ul>

		<!-- Indicators -->
		<h3 class="event-legend__heading">
			{{ t('calendar', 'Indicators') }}
		</h3>
		<ul class="event-legend__list">
			<li class="event-legend__item">
				<div class="event-legend__demo event-legend__demo--busy">
					<span class="event-legend__demo-title">{{ t('calendar', 'Busy') }}</span>
				</div>
				<span class="event-legend__label">{{ t('calendar', 'Your time is marked as occupied') }}</span>
			</li>
			<li class="event-legend__item">
				<div class="event-legend__demo event-legend__demo--free">
					<span class="event-legend__demo-title">{{ t('calendar', 'Free') }}</span>
				</div>
				<span class="event-legend__label">{{ t('calendar', 'Your time is still available') }}</span>
			</li>
			<li class="event-legend__item">
				<div class="event-legend__demo event-legend__demo--duration">
					<span class="event-legend__demo-title">{{ t('calendar', 'Duration') }}</span>
				</div>
				<span class="event-legend__label">{{ t('calendar', 'The thin line above the title shows the duration of the event in relation to one day') }}</span>
			</li>
			<li class="event-legend__item">
				<div class="event-legend__demo event-legend__demo--accepted">
					<span class="event-legend__demo-title">
						<!-- People icon (Material Symbols) -->
						<svg class="event-legend__icon" viewBox="0 -960 960 960" aria-hidden="true">
							<path d="M40-160v-112q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v112H40Zm640 0v-112q0-51-26-95.5T586-441q51 6 98 20.5t84 35.5q36 20 57 44.5t21 52.5v112H680ZM360-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm400-160q0 66-47 113t-113 47q-11 0-28-2.5t-28-5.5q27-32 41.5-71t14.5-81q0-42-14.5-81T544-792q14-5 28-6.5t28-1.5q66 0 113 47t47 113Z" />
						</svg>
						{{ t('calendar', 'Attendees') }}
					</span>
				</div>
				<span class="event-legend__label">{{ t('calendar', 'This event has one or more attendees') }}</span>
			</li>
			<li class="event-legend__item">
				<div class="event-legend__demo event-legend__demo--past">
					<span class="event-legend__demo-title">{{ t('calendar', 'Past event') }}</span>
				</div>
				<span class="event-legend__label">{{ t('calendar', 'Events that have already ended keep their formatting and are shown in a lighter color') }}</span>
			</li>
		</ul>
	</NcAppSettingsSection>
</template>

<script>
import { translate as t } from '@nextcloud/l10n'
import { NcAppSettingsSection } from '@nextcloud/vue'

export default {
	name: 'EventLegend',

	components: {
		NcAppSettingsSection,
	},

	methods: {
		t,
	},
}
</script>

<style lang="scss" scoped>
$c: var(--color-primary-element);
// Same lightening the grid applies to past events: lightness up in OKLab,
// perceived hue untouched (see lightenColorForPastEvents)
$c-past: oklch(from var(--color-primary-element) 83% min(c, 0.07) h);

// Thickness of the thin duration line; the vertical bar is four times as wide
$line-w: calc(var(--default-grid-baseline) / 2);
$border-w: calc(var(--default-grid-baseline) * 2);

.event-legend {
	&__intro {
		color: var(--color-text-maxcontrast);
		margin-block-end: var(--default-grid-baseline);
	}

	&__heading {
		font-size: var(--default-font-size);
		font-weight: bold;
		margin-block: calc(var(--default-grid-baseline) * 3) var(--default-grid-baseline);
		color: var(--color-main-text);
	}

	&__list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: calc(var(--default-grid-baseline) * 2);
	}

	&__item {
		display: flex;
		align-items: center;
		gap: calc(var(--default-grid-baseline) * 3);
	}

	&__label {
		color: var(--color-main-text);
		font-size: var(--default-font-size);
	}

	// Events carry no fill and no frame: the vertical left bar (the demo
	// default) marks busy time, square on all corners
	&__demo {
		flex-shrink: 0;
		width: calc(var(--default-grid-baseline) * 30);
		min-height: calc(var(--default-grid-baseline) * 7);
		border-radius: 0;
		padding-block: var(--default-grid-baseline);
		padding-inline: calc(var(--default-grid-baseline) * 2);
		display: flex;
		align-items: center;
		gap: var(--default-grid-baseline);
		position: relative;
		font-size: var(--default-font-size);

		border-block-start-width: 0;
		border-block-end-width: 0;
		border-inline-end-width: 0;
		border-inline-start: $border-w solid $c;
		border-style: solid;

		// Free: a hollow box instead of the solid bar, its frame as thick as
		// the duration line
		&--free {
			border-inline-start-color: transparent;

			&::before {
				content: '';
				position: absolute;
				inset-inline-start: calc(-1 * #{$border-w});
				inset-block: 0;
				width: $border-w;
				border: $line-w solid $c;
				box-sizing: border-box;
			}
		}

		// Past events keep their formatting; only the bar color is lighter
		&--past {
			border-inline-start-color: $c-past;
		}

		// The thin line above the title shows the event's duration, docked
		// to the vertical bar
		&--duration::before {
			content: '';
			position: absolute;
			inset-block-start: 0;
			inset-inline-start: 0;
			// Illustrative proportion: an event of about half a day
			width: 50%;
			border-block-start: $line-w solid $c;
		}
	}

	&__demo-title {
		// Confirmed events are emphasized; states that are not (yet) taking
		// place use the regular modifier, tentative ones the italic one
		font-weight: bold;
		color: var(--color-main-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: flex;
		align-items: center;
		gap: var(--default-grid-baseline);

		&--regular {
			font-weight: normal;
		}

		&--italic {
			font-style: italic;
		}

		&--strikethrough {
			text-decoration: line-through;
		}
	}

	&__icon {
		width: 1em;
		height: 1em;
		vertical-align: middle;
		fill: var(--color-main-text);
		flex-shrink: 0;
	}
}
</style>
