import { Upload } from 'tus-js-client';

function uploadFile(file: File) {
	const upload = new Upload(file, {
		endpoint: '/files', // the Cloudflare worker should be running at this URL
		retryDelays: [0, 1000, 5000],
		chunkSize: 5 * 1024 * 1024, // 1000 * 1000 * 100,
		parallelUploads: 1,
		metadata: {
			filename: file.name,
			filetype: file.type,
		},
		onError: (err) => {
			console.error(err);
		},
		onProgress: (uploaded, total) => {
			const pct = Math.floor(uploaded / total * 100);
			console.log('upload: ' + pct + '%');
		},
	});
	return upload.start();
}

(function setup() {
	const el = document.getElementById('file');
	if (!el) {
		throw new Error('failed to find file input element!');
	}
	el.addEventListener('change', (e) => {
	const input = <HTMLInputElement>e.target;
		if (!input.files) {
			throw new Error('input element did not contain any associated files');
		}
		const file = input.files[0];
		uploadFile(file);
	});
})();

export {};
