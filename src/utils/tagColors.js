// Shared color + emoji defaults for tags (categories). Used by:
// - Manage Tags (color/emoji pickers, Phase 3)
// - auto-assigning a color to newly created tags that haven't picked one
// - anywhere a tag's identity needs to render consistently: Home tag boxes and
//   charts, Library rows, tag pickers (Phase 2/4)
//
// Keeping this in one place means "what does tag X look like" only has one source of
// truth instead of each screen guessing its own fallback.

export const TAG_COLOR_PALETTE = [
	// Blues & Indigos
	'#6C8EF5', '#4F6FD4', '#7EB8F7', '#A0C4FF', '#3D72B4',
	// Purples
	'#B87CE0', '#C98CE0', '#9B59B6', '#D4A0F5', '#7B2FBE',
	// Pinks & Reds
	'#E07CA5', '#E56C6C', '#FF7096', '#FF5A87', '#C0392B',
	// Oranges & Yellows
	'#F5A65C', '#F39C12', '#FFBE76', '#E0C15C', '#FFD700',
	// Greens & Teals
	'#5CC9A7', '#8CD16C', '#27AE60', '#6CC5E5', '#1ABC9C',
	// Neutrals
	'#95A5A6', '#BDC3C7', '#7F8C8D', '#AAB7B8',
];

// A reasonably broad, journal-relevant set to start the emoji picker with. Manage Tags
// (Phase 3) can still allow picking any system emoji beyond this list - these are just the
// quick-pick defaults.
export const TAG_EMOJI_PRESETS = [
	'📔',
	'💭',
	'😤',
	'🎙️',
	'📝',
	'💡',
	'🌙',
	'☀️',
	'🔥',
	'🎯',
	'❤️',
	'🧠',
	'🌱',
	'🎧',
	'📌',
	'✨',
	'🗓️',
	'🏃',
	'🍀',
	'🎉',
];

// Untagged is deliberately neutral/grey so it never gets confused with an actual tag's
// assigned color in charts, boxes, or list rows.
export const UNTAGGED_COLOR = '#7A8494';
export const UNTAGGED_ICON = '🎙️';

// Fallback icon for a real tag that hasn't set one (e.g. tags created before Phase 3
// added the icon field). Distinct from UNTAGGED_ICON so "no icon set" doesn't visually
// collide with the Untagged bucket itself.
export const DEFAULT_TAG_ICON = '🏷️';

// Deterministic color for the Nth tag created, so colors stay stable/predictable instead
// of random. Wraps around the palette once there are more tags than colors.
export function colorForIndex(index) {
	return TAG_COLOR_PALETTE[
		((index % TAG_COLOR_PALETTE.length) + TAG_COLOR_PALETTE.length) %
			TAG_COLOR_PALETTE.length
	];
}

// Safe accessors - every render site should go through these rather than reading
// category.color / category.icon directly, so the fallback logic only lives here.
export function colorForCategory(category) {
	return category?.color || UNTAGGED_COLOR;
}

export function iconForCategory(category) {
	return category?.icon || DEFAULT_TAG_ICON;
}
