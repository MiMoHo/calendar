/**
 * SPDX-FileCopyrightText: 2019 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import convert from 'color-convert'
import css3Colors from 'css-color-names'
import closestColor from './closestColor.js'
import { uidToColor } from './uidToColor.js'

/**
 * Detect if a color is light or dark
 *
 * @param {object} data The destructuring object
 * @param {number} data.red Red part of the RGB
 * @param {number} data.green Green part of the RGB
 * @param {number} data.blue Blue part of the RGB
 * @return {boolean} true if color is light, false if color is dark
 */
export function isLight({ red, green, blue }) {
	const brightness = (((red * 299) + (green * 587) + (blue * 114)) / 1000)
	return (brightness > 130)
}

/**
 * Get a text-color that's readable on a given background color
 *
 * @param {string} hexColor The hex color to get a text color for
 * @return {string} the matching text color
 */
export function generateTextColorForHex(hexColor) {
	return generateTextColorForRGB(hexToRGB(hexColor))
}

/**
 * Get a text-color that's readable on a given background color
 *
 * @param {object} data The destructuring object
 * @param {number} data.red Red part of the RGB
 * @param {number} data.green Green part of the RGB
 * @param {number} data.blue Blue part of the RGB
 * @return {string}
 */
export function generateTextColorForRGB({ red, green, blue }) {
	return isLight({ red, green, blue }) ? '#000000' : '#FAFAFA'
}

/**
 * Convert hex string to RGB
 *
 * @param {string} hexColor The hex color to convert
 * @return {string} the RGB result
 */
export function hexToRGB(hexColor) {
	if (hexColor === null) {
		return { red: 0, green: 0, blue: 0 }
	}
	const [red, green, blue] = convert.hex.rgb(hexColor.slice(1))
	return { red, green, blue }
}

/**
 * Generates a hex color based on RGB string
 *
 * @param {string} uid The string to generate a color from
 * @return {string} The hex color
 */
export function uidToHexColor(uid) {
	const color = uidToColor(uid)
	return '#' + convert.rgb.hex(color.r, color.g, color.b)
}

/**
 * Lightens a color for past events. The lightness is raised while hue and
 * saturation stay untouched, so a dark blue fades to a light blue - the
 * alpha blend over white used before drained the saturation, which made
 * dark blues read as violet.
 *
 * @param {string} hexColor The color of the event or calendar
 * @return {string|null} The lightened hex color, null for invalid input
 */
export function lightenColorForPastEvents(hexColor) {
	if (typeof hexColor !== 'string' || !/^#((?:[A-Fa-f0-9]{3}){1,2})$/.test(hexColor)) {
		return null
	}

	// The lightening happens in OKLab: HSL lightening shifts dark blues
	// visibly towards violet (the very shift OKLab was designed to avoid),
	// so medium blue fades to a light blue here instead of lavender.
	const [red, green, blue] = convert.hex.rgb(hexColor.slice(1))
	const [lightness, a, b] = rgbToOklab(red, green, blue)
	const chroma = Math.min(Math.hypot(a, b), 0.07)
	const hue = Math.atan2(b, a)
	const lightened = Math.min(0.93, Math.max(0.83, lightness + 0.25))
	const [r2, g2, b2] = oklabToRgb(lightened, chroma * Math.cos(hue), chroma * Math.sin(hue))
	return '#' + convert.rgb.hex([r2, g2, b2])
}

/**
 * Converts an sRGB color (0-255 channels) to OKLab
 *
 * @param {number} red The red channel
 * @param {number} green The green channel
 * @param {number} blue The blue channel
 * @return {number[]} Lightness, a and b
 */
function rgbToOklab(red, green, blue) {
	const toLinear = (channel) => {
		const c = channel / 255
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
	}
	const [lr, lg, lb] = [toLinear(red), toLinear(green), toLinear(blue)]
	const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
	const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
	const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	]
}

/**
 * Converts an OKLab color back to sRGB (0-255 channels, gamut-clamped)
 *
 * @param {number} lightness The OKLab lightness
 * @param {number} a The OKLab a component
 * @param {number} b The OKLab b component
 * @return {number[]} Red, green and blue
 */
function oklabToRgb(lightness, a, b) {
	const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
	const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
	const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
	const fromLinear = (channel) => {
		const c = channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055
		return Math.round(Math.min(1, Math.max(0, c)) * 255)
	}
	return [
		fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
		fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
		fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
	]
}

/**
 * Detects a color from a given string
 *
 * @param {string} color The color to get the real RGB hex string from
 * @return {string|boolean|*} String if color detected, boolean if not
 */
export function detectColor(color) {
	if (/^(#)((?:[A-Fa-f0-9]{3}){1,2})$/.test(color)) { // #ff00ff and #f0f
		return color
	} else if (/^((?:[A-Fa-f0-9]{3}){1,2})$/.test(color)) { // ff00ff and f0f
		return '#' + color
	} else if (/^(#)((?:[A-Fa-f0-9]{8}))$/.test(color)) { // #ff00ffff and #f0ff
		return color.slice(0, 7)
	} else if (/^((?:[A-Fa-f0-9]{8}))$/.test(color)) { // ff00ffff and f0ff
		return '#' + color.slice(0, 6)
	}

	return false
}

/**
 * Gets the HEX code for a css3 color name
 *
 * @param {string} colorName The name of the css3 color
 * @return {string | null} string of HEX if valid color, null if not
 */
export function getHexForColorName(colorName) {
	return css3Colors[colorName] || null
}

/**
 * Gets the closest css3 color name for a given HEX code
 *
 * @param {string} hex The HEX code to get a css3 color name for
 * @return {string}
 */
export function getClosestCSS3ColorNameForHex(hex) {
	return closestColor(hex)
}
