require('dotenv').config();

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { TussleStorageS3 } = require('@tussle/storage-s3');
const { TussleRequestAxios } = require('@tussle/request-axios');
const { TussleStateMemory } = require('@tussle/state-memory');
const { TussleVanilla } = require('@tussle/middleware-vanilla');

const STATIC_FILES = {
	'/': 'index.html',
	'/client-bundle.js': 'client-bundle.js',
	'/favicon.ico': 404,
};


function serve(port = process.env.PORT || '8080') {
	const tussle = new TussleVanilla({
		hooks: {
			'before-create': async (_ctx, params) => {
				console.log('before create called', params.path, params.uploadMetadata.filename);
				params.path = path.join(params.path, params.uploadMetadata.filename);
				return params;
			},
			'before-patch': async (_ctx, params) => {
				console.log('before patch called', params.location);
				return params;
			},
			'after-complete': async (_ctx, params) => {
				console.log('upload completed:', JSON.stringify(params, null, 2));
				return params;
			},
		},
		core: {
			storage: new TussleStorageS3({
				s3: {
					bucket: process.env.TUSSLE_S3_BUCKET,
					client: {
						endpoint: process.env.TUSSLE_S3_ENDPOINT,
						region: 'us-west-001',
						credentials: {
							accessKeyId: process.env.TUSSLE_S3_KEY_ID,
							secretAccessKey: process.env.TUSSLE_S3_KEY,
						}
					},
				},
				stateService: new TussleStateMemory(),
				requestService: new TussleRequestAxios(),
			}),
		},
	});

	const server = http.createServer();

	server.on('request', async (request, response) => {
		// The following block is just for serving client bundles, not necessary
		// for overall use of Tussle.
		const pathname = request.url || '/';
		if (pathname in STATIC_FILES) {
			if (typeof STATIC_FILES[pathname] === 'number') {
				response.statusCode = STATIC_FILES[pathname];
				response.end();
				return;
			}
			const filepath = path.join(__dirname, STATIC_FILES[pathname]);
			const readable = fs.createReadStream(filepath);
			readable.pipe(response);
			return;
		}

		// The request doesn't match any static file paths, now we pass the request
		// off to Tussle.
		const tussleResponse = await tussle.handleRequest({request, response});

		// If Tussle didn't handle the request, then just respond with 404
		if (!tussleResponse) {
			response.statusCode = 404;
			response.end();
		}
	});

	server.listen(port);
}

console.clear();
serve();
