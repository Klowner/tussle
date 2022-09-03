const { join } = require('path');
module.exports = {
	parserOptions: {
		project: join(__dirname, "tsconfig.json"),
	}
}
