/**
 * SPDX-FileCopyrightText: 2021 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import {
	addMailtoPrefix,
	organizerDisplayName,
	parseMailboxQuery,
	removeMailtoPrefix,
} from '../../../../src/utils/attendee'

describe('utils/attendee test suite', () => {
	it('should remove mailto prefixes from uris', () => {
		const uri = 'principal@test.com'
		expect(removeMailtoPrefix(uri)).toEqual(uri)
		expect(removeMailtoPrefix(`mailto:${uri}`)).toEqual(uri)
		expect(removeMailtoPrefix(`MAILTO:${uri}`)).toEqual(uri)
		expect(removeMailtoPrefix(`MailTo:${uri}`)).toEqual(uri)
	})

	it('should return blank strings when uris are not of type string', () => {
		expect(removeMailtoPrefix(null)).toEqual('')
		expect(removeMailtoPrefix(undefined)).toEqual('')
	})

	it('should add mailto prefixes to uris', () => {
		const uri = 'principal@test.com'
		const uriWithPrefix = `mailto:${uri}`
		expect(addMailtoPrefix(uri)).toEqual(uriWithPrefix)
		expect(addMailtoPrefix(uriWithPrefix)).toEqual(uriWithPrefix)
	})
	
	it('should add mailto prefixes to uris when they are not of type string', () => {
		expect(addMailtoPrefix(null)).toEqual("mailto:")
		expect(addMailtoPrefix(undefined)).toEqual("mailto:")
	})

	it('should extract a display name of an organizer', () => {
		const commonName = 'My Name'
		const uri = 'uri@test.com'
		expect(organizerDisplayName(null)).toEqual('')
		expect(organizerDisplayName(undefined)).toEqual('')
		expect(organizerDisplayName({ commonName })).toEqual(commonName)
		expect(organizerDisplayName({ uri })).toEqual(uri)
		expect(organizerDisplayName({ uri: `mailto:${uri}` })).toEqual(uri)
		expect(organizerDisplayName({
			commonName,
			uri,
		})).toEqual(commonName)
	})

	it('should split a full mailbox into name and address', () => {
		expect(parseMailboxQuery('Boss <boss@example.com>'))
			.toEqual({ name: 'Boss', email: 'boss@example.com' })
		expect(parseMailboxQuery('"Boss, Big" <boss@example.com>'))
			.toEqual({ name: 'Boss, Big', email: 'boss@example.com' })
		expect(parseMailboxQuery('boss@example.com <boss@example.com>'))
			.toEqual({ name: 'boss@example.com', email: 'boss@example.com' })
		expect(parseMailboxQuery('<boss@example.com>'))
			.toEqual({ name: 'boss@example.com', email: 'boss@example.com' })
	})

	it('should pass plain queries through unchanged', () => {
		expect(parseMailboxQuery('boss@example.com'))
			.toEqual({ name: 'boss@example.com', email: 'boss@example.com' })
		expect(parseMailboxQuery('  boss@example.com  '))
			.toEqual({ name: 'boss@example.com', email: 'boss@example.com' })
		expect(parseMailboxQuery('Boss'))
			.toEqual({ name: 'Boss', email: 'Boss' })
		expect(parseMailboxQuery(null))
			.toEqual({ name: '', email: '' })
	})
})
