// Naming templates support three kinds of tokens:
//   {tag}              -> the category's display name
//   <count>             -> the next auto-increment number (computed from actual remaining
//                          entries for that tag/untagged bucket - see db/categories.js)
//   <date>              -> today's date, default format DD-MM-YYYY
//   <date:PATTERN>      -> today's date in a custom format, e.g. <date:DD/MM/YYYY>
//   <time:PATTERN>      -> time of recording in a custom format, e.g. <time:hh:mm>
//
// Date pattern tokens: YYYY, YY, MM, DD, MON (3-letter month, e.g. Jul)
// Time pattern tokens: hh (24hr), mm (minutes), ss (seconds), SSS (milliseconds)

const MONTH_ABBR = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
];

export const DATE_FORMAT_PRESETS = [
	{ key: 'DD MM YYYY', pattern: 'DD MM YYYY' },
	{ key: 'DD/MM/YYYY', pattern: 'DD/MM/YYYY' },
	{ key: 'DD-MM-YY', pattern: 'DD-MM-YY' },
	{ key: 'DD MM YY', pattern: 'DD MM YY' },
	{ key: 'DD/MM/YY', pattern: 'DD/MM/YY' },
	{ key: 'DD MON YYYY', pattern: 'DD MON YYYY' },
	{ key: 'DD-MON-YYYY', pattern: 'DD-MON-YYYY' },
	{ key: 'DD MON YY', pattern: 'DD MON YY' },
	{ key: 'DD-MON-YY', pattern: 'DD-MON-YY' },
];

export const TIME_FORMAT_PRESETS = [
	{ key: 'mm:ss', pattern: 'mm:ss' },
	{ key: 'mm:ss.SSS', pattern: 'mm:ss.SSS' },
	{ key: 'hh:mm', pattern: 'hh:mm' },
	{ key: 'hh:mm:ss', pattern: 'hh:mm:ss' },
	{ key: 'hh:mm:ss.SSS', pattern: 'hh:mm:ss.SSS' },
];

export function formatDateWithPattern(timestamp, pattern) {
	const d = new Date(timestamp);
	const yyyy = String(d.getFullYear());
	const yy = yyyy.slice(-2);
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	const mon = MONTH_ABBR[d.getMonth()];

	return pattern
		.replace(/YYYY/g, yyyy)
		.replace(/YY/g, yy)
		.replace(/MON/g, mon)
		.replace(/MM/g, mm)
		.replace(/DD/g, dd);
}

export function formatTimeWithPattern(timestamp, pattern) {
	const d = new Date(timestamp);
	const hh = String(d.getHours()).padStart(2, '0');
	const mm = String(d.getMinutes()).padStart(2, '0');
	const ss = String(d.getSeconds()).padStart(2, '0');
	const SSS = String(d.getMilliseconds()).padStart(3, '0');

	return pattern
		.replace(/SSS/g, SSS)
		.replace(/hh/g, hh)
		.replace(/mm/g, mm)
		.replace(/ss/g, ss);
}

export function formatDateDDMMYYYY(timestamp = Date.now()) {
	return formatDateWithPattern(timestamp, 'DD-MM-YYYY');
}

export function renderTemplate(
	template,
	{ tag, name, count, timestamp = Date.now() } = {},
) {
	let result = template || '{tag} <count>';
	result = result.replace(/{tag}/g, tag || 'Recording');
	result = result.replace(/{name}/g, name || 'Recording');
	result = result.replace(/<count>/g, String(count ?? 1));
	result = result.replace(/<date:([^>]+)>/g, (_, pattern) =>
		formatDateWithPattern(timestamp, pattern),
	);
	result = result.replace(/<time:([^>]+)>/g, (_, pattern) =>
		formatTimeWithPattern(timestamp, pattern),
	);
	result = result.replace(/<date>/g, formatDateDDMMYYYY(timestamp));
	return result;
}

export const DEFAULT_CATEGORY_TEMPLATE = '{tag} <count>';
export const DEFAULT_UNTAGGED_TEMPLATE = 'Recording <count> <date>';
export const DEFAULT_TRIM_TEMPLATE =
	'{name} trimmed <date:DD-MM-YYYY> <time:hh:mm>';
export const DEFAULT_MERGE_TEMPLATE =
	'{name} merged <date:DD-MM-YYYY> <time:hh:mm>';
export const DEFAULT_APPEND_TEMPLATE =
	'{name} append <date:DD-MM-YYYY> <time:hh:mm>';

// "trimmed 25-07-2026 14:32" - kept for any caller wanting just the suffix rather than a full
// {name}-based template render.
export function derivedNameSuffix(timestamp = Date.now()) {
	const date = formatDateWithPattern(timestamp, 'DD-MM-YYYY');
	const time = formatTimeWithPattern(timestamp, 'hh:mm');
	return `${date} ${time}`;
}
