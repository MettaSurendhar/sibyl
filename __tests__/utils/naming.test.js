import { renderTemplate, formatDateWithPattern, formatTimeWithPattern } from '../../src/utils/naming';

describe('naming utils', () => {
	const mockTimestamp = new Date('2026-08-19T14:32:45.123').getTime();

	it('should format dates correctly with patterns', () => {
		expect(formatDateWithPattern(mockTimestamp, 'DD-MM-YYYY')).toBe('19-08-2026');
		expect(formatDateWithPattern(mockTimestamp, 'DD MON YYYY')).toBe('19 Aug 2026');
		expect(formatDateWithPattern(mockTimestamp, 'DD/MM/YY')).toBe('19/08/26');
	});

	it('should format times correctly with patterns', () => {
		expect(formatTimeWithPattern(mockTimestamp, 'hh:mm')).toBe('14:32');
		expect(formatTimeWithPattern(mockTimestamp, 'hh:mm:ss')).toBe('14:32:45');
		expect(formatTimeWithPattern(mockTimestamp, 'mm:ss.SSS')).toBe('32:45.123');
	});

	it('should render templates correctly', () => {
		expect(
			renderTemplate('Recording <count> <date>', { count: 3, timestamp: mockTimestamp })
		).toBe('Recording 3 19-08-2026');

		expect(
			renderTemplate('{tag} <count>', { tag: 'Idea', count: 42, timestamp: mockTimestamp })
		).toBe('Idea 42');

		expect(
			renderTemplate('{name} trimmed <date:DD-MM-YYYY> <time:hh:mm>', {
				name: 'Test File',
				timestamp: mockTimestamp,
			})
		).toBe('Test File trimmed 19-08-2026 14:32');

		expect(
			renderTemplate('{name} appended <date:DD/MM/YY>', {
				name: 'My Audio',
				timestamp: mockTimestamp,
			})
		).toBe('My Audio appended 19/08/26');
	});
});
