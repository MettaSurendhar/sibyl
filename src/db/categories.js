import { getDb, newId } from './database';
import {
	renderTemplate,
	DEFAULT_CATEGORY_TEMPLATE,
	DEFAULT_UNTAGGED_TEMPLATE,
	DEFAULT_TRIM_TEMPLATE,
	DEFAULT_MERGE_TEMPLATE,
	DEFAULT_APPEND_TEMPLATE,
} from '../utils/naming';
import {
	colorForIndex,
	DEFAULT_TAG_ICON,
	UNTAGGED_COLOR,
	UNTAGGED_ICON,
} from '../utils/tagColors';

export async function listCategories() {
	const db = await getDb();
	return db.getAllAsync('SELECT * FROM categories ORDER BY sortOrder ASC');
}

export async function createCategory({
	name,
	prefix,
	color,
	icon,
	nameTemplate,
}) {
	const db = await getDb();
	const id = newId('cat');
	const countRow = await db.getFirstAsync(
		'SELECT COUNT(*) as c FROM categories',
	);
	await db.runAsync(
		'INSERT INTO categories (id, name, prefix, counter, color, sortOrder, nameTemplate, icon) VALUES (?, ?, ?, 0, ?, ?, ?, ?)',
		[
			id,
			name,
			prefix || name,
			// Auto-assign the next palette color if none was chosen, rather than defaulting
			// every new tag to the same blue - keeps Home boxes/charts distinguishable
			// without forcing the user through the color picker.
			color || colorForIndex(countRow.c),
			countRow.c,
			nameTemplate || DEFAULT_CATEGORY_TEMPLATE,
			icon || DEFAULT_TAG_ICON,
		],
	);
	return id;
}

export async function updateCategory(
	id,
	{ name, prefix, color, icon, nameTemplate },
) {
	const db = await getDb();
	await db.runAsync(
		'UPDATE categories SET name = ?, prefix = ?, color = ?, icon = ?, nameTemplate = ? WHERE id = ?',
		[name, prefix, color, icon, nameTemplate, id],
	);
}

export async function deleteCategory(id) {
	const db = await getDb();
	await db.runAsync(
		'UPDATE entries SET categoryId = NULL WHERE categoryId = ?',
		[id],
	);
	await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
}

// Counts entries CURRENTLY tagged with this category. This (not a persisted incrementing
// counter) is what drives "next count" - so deleting recordings genuinely frees up numbers,
// rather than the count marching on forever regardless of deletions.
export async function getCategoryEntryCount(categoryId) {
	const db = await getDb();
	const row = await db.getFirstAsync(
		'SELECT COUNT(*) as c FROM entries WHERE categoryId = ?',
		[categoryId],
	);
	return row?.c || 0;
}

export async function getUntaggedEntryCount() {
	const db = await getDb();
	const row = await db.getFirstAsync(
		'SELECT COUNT(*) as c FROM entries WHERE categoryId IS NULL',
	);
	return row?.c || 0;
}

// One row per tag (plus a trailing Untagged row), each with its live entry count, color and
// icon already resolved. This is the single query the Home screen's tag boxes, and the pie
// chart's slice list, both read from - one aggregate query rather than N+1 count calls.
export async function getAllTagCounts() {
	const db = await getDb();
	const rows = await db.getAllAsync(`
    SELECT c.id as id, c.name as name, c.icon as icon, c.color as color,
           COUNT(e.id) as count
    FROM categories c
    LEFT JOIN entries e ON e.categoryId = c.id
    GROUP BY c.id
    ORDER BY c.sortOrder ASC
  `);
	const untaggedCount = await getUntaggedEntryCount();
	return [
		...rows,
		{
			id: null,
			name: 'Untagged',
			icon: UNTAGGED_ICON,
			color: UNTAGGED_COLOR,
			count: untaggedCount,
		},
	];
}

// Pie chart data source: for entries created directly via Record ('recorded', the default
// sourceType), break down by tag exactly like getAllTagCounts. Entries produced by
// Trim/Merge/Append are grouped as their own slices instead of by tag - they're a
// derivative of an existing recording rather than a fresh session, so mixing them into the
// tag slices would double-count the same underlying audio. This is the one open design
// call flagged in the phase plan: same chart, separate slices, rather than a second chart.
export async function getPieBreakdown() {
	const db = await getDb();
	const tagRows = await db.getAllAsync(`
    SELECT c.id as id, c.name as name, c.icon as icon, c.color as color, COUNT(e.id) as count
    FROM categories c
    LEFT JOIN entries e ON e.categoryId = c.id AND (e.sourceType IS NULL OR e.sourceType = 'recorded')
    GROUP BY c.id
  `);
	const untaggedRow = await db.getFirstAsync(
		"SELECT COUNT(*) as c FROM entries WHERE categoryId IS NULL AND (sourceType IS NULL OR sourceType = 'recorded')",
	);
	const opRows = await db.getAllAsync(`
    SELECT sourceType, COUNT(*) as count FROM entries
    WHERE sourceType IN ('trimmed', 'merged', 'appended')
    GROUP BY sourceType
  `);
	const opMeta = {
		trimmed: { name: 'Trimmed', color: '#E0C15C', icon: 'content-cut' },
		merged: { name: 'Merged', color: '#6CC5E5', icon: 'link' },
		appended: { name: 'Appended', color: '#B87CE0', icon: 'plus' },
	};
	const slices = [
		...tagRows.map((r) => ({
			key: r.id,
			name: r.name,
			color: r.color,
			icon: r.icon,
			count: r.count,
		})),
		{
			key: 'untagged',
			name: 'Untagged',
			color: UNTAGGED_COLOR,
			icon: UNTAGGED_ICON,
			count: untaggedRow?.c || 0,
		},
		...opRows.map((r) => ({
			key: r.sourceType,
			...opMeta[r.sourceType],
			count: r.count,
		})),
	];
	return slices.filter((s) => s.count > 0);
}

// Preview-only: what the name WOULD be if this category is chosen, without saving anything.
export async function previewNameForCategory(category) {
	if (!category) return null;
	const count = (await getCategoryEntryCount(category.id)) + 1;
	return renderTemplate(category.nameTemplate || DEFAULT_CATEGORY_TEMPLATE, {
		tag: category.name,
		count,
	});
}

// Final name at actual save time - same count logic, just called at the moment of saving.
export async function nextNameForCategory(categoryId) {
	const db = await getDb();
	const cat = await db.getFirstAsync('SELECT * FROM categories WHERE id = ?', [
		categoryId,
	]);
	if (!cat) return null;
	const count = (await getCategoryEntryCount(categoryId)) + 1;
	return renderTemplate(cat.nameTemplate || DEFAULT_CATEGORY_TEMPLATE, {
		tag: cat.name,
		count,
	});
}

// --- Untagged ("no category picked") naming - same "count reflects reality" approach ---

export async function getUntaggedTemplate() {
	const db = await getDb();
	const row = await db.getFirstAsync(
		"SELECT value FROM settings WHERE key = 'untaggedTemplate'",
	);
	return row?.value || DEFAULT_UNTAGGED_TEMPLATE;
}

export async function setUntaggedTemplate(template) {
	const db = await getDb();
	await db.runAsync(
		"UPDATE settings SET value = ? WHERE key = 'untaggedTemplate'",
		[template],
	);
}

export async function previewUntaggedName() {
	const count = (await getUntaggedEntryCount()) + 1;
	const template = await getUntaggedTemplate();
	return renderTemplate(template, { count });
}

export async function nextUntaggedName() {
	const count = (await getUntaggedEntryCount()) + 1;
	const template = await getUntaggedTemplate();
	return renderTemplate(template, { count });
}

// --- Naming templates for derived recordings (Trim/Merge/Append each create a new entry,
// each with its own default naming template, configurable in Settings) ---

async function getOperationTemplate(key, fallback) {
	const db = await getDb();
	const row = await db.getFirstAsync(
		'SELECT value FROM settings WHERE key = ?',
		[key],
	);
	return row?.value || fallback;
}

async function setOperationTemplate(key, template) {
	const db = await getDb();
	await db.runAsync('UPDATE settings SET value = ? WHERE key = ?', [
		template,
		key,
	]);
}

export const getTrimTemplate = () =>
	getOperationTemplate('trimTemplate', DEFAULT_TRIM_TEMPLATE);
export const setTrimTemplate = (t) => setOperationTemplate('trimTemplate', t);
export const getMergeTemplate = () =>
	getOperationTemplate('mergeTemplate', DEFAULT_MERGE_TEMPLATE);
export const setMergeTemplate = (t) => setOperationTemplate('mergeTemplate', t);
export const getAppendTemplate = () =>
	getOperationTemplate('appendTemplate', DEFAULT_APPEND_TEMPLATE);
export const setAppendTemplate = (t) =>
	setOperationTemplate('appendTemplate', t);

// Total recordings made so far (used for the live "Recording #N" title on the Record screen).
export async function totalEntryCount() {
	const db = await getDb();
	const row = await db.getFirstAsync('SELECT COUNT(*) as c FROM entries');
	return row?.c || 0;
}
