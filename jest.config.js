const fs = require('fs');
const path = require('path');

const packagesDir = path.join(__dirname, 'packages');
const packagesExclude = ['spec'];

function collectPackageDirs() {
	const packages = fs.readdirSync(packagesDir);
	return packages.filter(file => (
		fs.statSync(path.join(packagesDir, file)).isDirectory()
		&& !packagesExclude.includes(file)
	));
}

module.exports = {
	verbose: false,
	projects: collectPackageDirs().map(name => `<rootDir>/packages/${name}/jest.config.js`),
};
