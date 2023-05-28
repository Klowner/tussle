import { Upload } from 'tus-js-client';

// The parallelUploadBoundaries feature requires tus-js-client 3.0 or newer.
// While it is not necessary for tussle to function, it is included in this
// example to demonstrate how to ensure all uploaded chunks within each
// parallel upload segment are of equal size (excluding the last chunk
// of the final segment). This is to make the individual R2 records compatible
// with multipart upload requirements as defined by the S3 API.
function calculateBoundaries(
	totalSize: number,
	chunkSize: number,
	maxParallelUploads: number,
): {
	parallelUploads: number;
	parallelUploadBoundaries?: {
		start: number;
		end: number;
	}[];
} {
	const numChunks = Math.ceil(totalSize / chunkSize);
	const parallelUploads = Math.min(numChunks, maxParallelUploads);
	if (parallelUploads > 1) {
		const bytesPerThread = Math.floor(numChunks / parallelUploads) * chunkSize;
		const ranges: {start:number; end:number}[] = [];
		for (let i = 0; i < parallelUploads; i++) {
			ranges[i] = {
				start: bytesPerThread * i,
				end: bytesPerThread * (i + 1),
			};
		}
		const remainder = totalSize - (bytesPerThread * parallelUploads);
		ranges[parallelUploads - 1].end += remainder;
		return {
			parallelUploads,
			parallelUploadBoundaries: ranges,
		};
	}
	return {
		parallelUploads,
	};
}

function uploadFile(file: File) {
	const chunkSize = 8 * 1024 * 1024;
	const maxParallelUploads = 4;
	const { parallelUploads, parallelUploadBoundaries } = calculateBoundaries(file.size, chunkSize, maxParallelUploads);
	const upload = new Upload(file, {
		endpoint: '/files', // the Cloudflare worker should be running at this URL
		retryDelays: [0, 1000, 5000],
		chunkSize,
		parallelUploads,
		parallelUploadBoundaries,
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
