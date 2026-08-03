// Shared color + emoji defaults for tags (categories). Used by:
// - Manage Tags (color/emoji pickers, Phase 3)
// - auto-assigning a color to newly created tags that haven't picked one
// - anywhere a tag's identity needs to render consistently: Home tag boxes and
//   charts, Library rows, tag pickers (Phase 2/4)
//
// Keeping this in one place means "what does tag X look like" only has one source of
// truth instead of each screen guessing its own fallback.

export const TAG_COLOR_PALETTE = [
	'#6C8EF5', // blue
	'#F5A65C', // orange
	'#E56C6C', // red
	'#5CC9A7', // teal
	'#B87CE0', // purple
	'#E0C15C', // yellow
	'#6CC5E5', // sky
	'#E07CA5', // pink
	'#8CD16C', // green
	'#C98CE0', // lavender
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
