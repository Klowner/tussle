import { Upload } from 'tus-js-client';

function uploadFile(file: File) {
	const chunkSize = 10 * 1024 * 1024;
	const upload = new Upload(file, {
		endpoint: '/files', // the Cloudflare worker should be running at this URL
		retryDelays: [0, 1000, 5000],
		chunkSize,
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
	upload.start();
	return upload;
}

function createRandomFile(size_bytes: number, name = 'random.bin'): File {
	const bytes = new Uint8Array(size_bytes);
	bytes.fill(42, 0, size_bytes);
	// const bytes = crypto.getRandomValues(new Uint8Array(size_bytes));
	return new File([new Blob([bytes])], name);
}

const uploads = new Set<Upload>();

function scaleUploads(desired: number) {
	while (uploads.size < desired) {
		const file = createRandomFile(1024 * 1024 * 50);
		const upload = uploadFile(file);
		uploads.add(upload);
		upload.options.onSuccess = () => {
			console.log(uploads.size);
			uploads.delete(upload);
			scaleUploads(desired);
		}
	}
	while (uploads.size > desired) {
		uploads.forEach((value) => {
			if (uploads.size > desired) {
				value.abort();
				uploads.delete(value);
			}
		});
	}
}

(function setup() {
	const toggleElement = document.getElementById('toggle');
	if (!toggleElement) {
		throw new Error('failed to find start/stop toggle element!');
	}
	const numClientsElement= document.getElementById('num-clients') as HTMLInputElement;
	if (!numClientsElement) {
		throw new Error('failed to find file input element!');
	}
	let numClients = parseInt(numClientsElement.value, 10);
	numClientsElement.addEventListener('change', (e) => {
		const input = <HTMLInputElement>e.target;
		numClients = parseInt(input.value, 10);
	});
	toggleElement.addEventListener('click', (e) => {
		if (uploads.size) {
			scaleUploads(0);
		} else {
			scaleUploads(numClients);
		}
	});

})();

export {};
