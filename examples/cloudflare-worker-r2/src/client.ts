import { Upload } from 'tus-js-client';

function calculateBoundaries(
	totalSize: number,
	chunkSize: number,
	parallelUploads: number,
): {start: number; end: number}[] {
	const numChunks = Math.ceil(totalSize / chunkSize);
	const bytesPerThread = Math.floor(numChunks / parallelUploads) * chunkSize;
	const ranges = [];
	for (let i = 0; i < parallelUploads; i++) {
		ranges[i] = {
			start: bytesPerThread * i,
			end: bytesPerThread * (i + 1),
		};
	}
	const remainder = totalSize - (bytesPerThread * parallelUploads);
	ranges[parallelUploads - 1].end += remainder;
	return ranges;
}

function uploadFile(file: File) {
	const chunkSize = 8 * 1024 * 1024;
	const parallelUploads = 4;
	const upload = new Upload(file, {
		endpoint: '/files', // the Cloudflare worker should be running at this URL
		retryDelays: [0, 1000, 5000],
		chunkSize,
		parallelUploads,
		parallelUploadBoundaries: calculateBoundaries(file.size, chunkSize, parallelUploads),
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
