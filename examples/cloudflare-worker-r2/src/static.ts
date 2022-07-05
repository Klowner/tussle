import INDEX_HTML from './static/index.html';
import CLIENT_JS from '../dist/client.js.gen'; // bundled output from 'src/client.js'

const STATIC_FILES: Readonly<Record<string, {body:string; contentType: string;}>> = {
	'/': {
		body: INDEX_HTML,
		contentType: 'text/html',
	},
	'/client.js': {
		body: CLIENT_JS,
		contentType: 'application/javascript',
	},
};

export function staticHandler(request: Request) {
	const { pathname } = new URL(request.url);
	const match = STATIC_FILES[pathname];
	if (match) {
		return new Response(match.body, {
			headers: {
				'Content-Type': match.contentType,
			},
		});
	} else {
		return new Response("Hi! I'm Tussle ❤️!" + pathname);
	}
}
