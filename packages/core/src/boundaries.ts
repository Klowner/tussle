export function calculateBoundaries(
	totalSize: number,
	chunkSize: number,
	maxParallelUploads: number,
)
// ): {
// 	parallelUploads: number;
// 	parallelUploadBoundaries: {
// 		start: number;
// 		end: number;
// 	}[],
 {
	const numChunks = Math.ceil(totalSize / chunkSize);
	const bytesPerThread = Math.floor(numChunks / maxParallelUploads) * chunkSize;
}

