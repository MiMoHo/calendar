/**
 * SPDX-FileCopyrightText: 2020 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import autosize from 'autosize'
import debounce from 'debounce'

let resizeObserver

if (window.ResizeObserver) {
	resizeObserver = new ResizeObserver(debounce((entries) => {
		for (const entry of entries) {
			autosize.update(entry.target)
		}
	}), 20)
}

/**
 * Adds autosize to a textarea when it is mounted
 *
 * @param {Element} el The DOM element
 * @param {object} binding The binding's object
 */
function mounted(el, binding) {
	// Check that the binding is true
	if (binding.value !== true) {
		return
	}

	// Verify this is actually a textarea
	if (el.tagName !== 'TEXTAREA') {
		return
	}

	requestAnimationFrame(() => {
		autosize(el)
	})

	if (resizeObserver) {
		resizeObserver.observe(el)
	}
}

/**
 * Updates the size of the textarea when updated
 *
 * @param {Element} el The DOM element
 * @param {object} binding The binding's object
 */
function updated(el, binding) {
	if (binding.value === true && binding.oldValue === false) {
		mounted(el, binding)
	}
	if (binding.value === false && binding.oldValue === true) {
		unmounted(el)
	}
	if (binding.value === true && binding.oldValue === true) {
		autosize.update(el)
	}
}

/**
 * Removes autosize when the textarea is removed
 *
 * @param {Element} el The DOM element
 */
function unmounted(el) {
	autosize.destroy(el)
	if (resizeObserver) {
		resizeObserver.unobserve(el)
	}
}

// Vue 3 directive hooks; the previous Vue 2 names (bind/update/unbind)
// were never invoked, so textareas silently lost their autosizing
export default {
	mounted,
	updated,
	unmounted,
}
