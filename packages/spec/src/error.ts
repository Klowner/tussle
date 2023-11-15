enum StorageErrorCode {
	ERROR_OFFSET_MISMATCH = 1000,
	UNSUPPORTED_MEDIA_TYPE,
}

export abstract class StorageError extends Error {
	constructor (
		message: string,
		readonly code: StorageErrorCode,
	) {
		super(message);
	}

	abstract toResponse(): {status: number; headers: Record<string, string>; body: string; };
}

export function isStorageError(err: unknown): err is StorageError {
	return err instanceof StorageError;
}

export class ChunkOffsetError extends StorageError {
	constructor (
		readonly location: string,
		readonly requestOffset: number,
		readonly expectedOffset: number,
	) {
		super(
			`invalid chunk offset: (${requestOffset} <> ${expectedOffset})`,
			StorageErrorCode.ERROR_OFFSET_MISMATCH,
		);
	}

	toResponse() {
		return {
			status: 409,
			headers: {},
			body: this.message,
		};
	}
}

export class UnsupportedMediaType extends StorageError {
	constructor (
		readonly location: string,
	) {
		super(
			'unsupported media type',
			StorageErrorCode.UNSUPPORTED_MEDIA_TYPE,
		);
	}

	toResponse() {
		return {
			status: 415,
			headers: {},
			body: this.message,
		};
	}
}

