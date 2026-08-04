const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walk(dir) {
	let results = [];
	const list = fs.readdirSync(dir);
	list.forEach(file => {
		file = path.join(dir, file);
		const stat = fs.statSync(file);
		if (stat && stat.isDirectory()) {
			results = results.concat(walk(file));
		} else if (file.endsWith('.js') && !file.endsWith('Text.js')) {
			results.push(file);
		}
	});
	return results;
}

const files = walk(srcDir);

files.forEach(file => {
	let content = fs.readFileSync(file, 'utf8');
	
	// Check if it imports Text from react-native
	if (content.includes('import ') && content.includes("'react-native'") && content.includes('Text')) {
		// Calculate relative path to src/theme/Text.js
		const fileDir = path.dirname(file);
		const targetPath = path.join(srcDir, 'theme', 'Text');
		let relativePath = path.relative(fileDir, targetPath).replace(/\\/g, '/');
		if (!relativePath.startsWith('.')) relativePath = './' + relativePath;

		// Replace { Text, ... } from 'react-native'
		content = content.replace(/(import\s+{[^}]*?)(\bText\b\s*,?\s*)([^}]*}\s+from\s+['"]react-native['"];?)/g, (match, p1, p2, p3) => {
			return p1 + p3 + `\nimport Text from '${relativePath}';`;
		});
		
		// Clean up empty { } imports from react-native if Text was the only one
		content = content.replace(/import\s+{\s*}\s+from\s+['"]react-native['"];?\n?/g, '');
		
		fs.writeFileSync(file, content, 'utf8');
		console.log(`Updated ${file}`);
	}
});
