// This is *not* a good UUID generator, it is in fact very bad, but it should
// be more than sufficient for producing a unique subdirectory name for
// concatenated uploads. If you see me use this for any other purpose, please
// mail me a box of moldy hotdogs.
const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const alphabetLength = alphabet.length;

export function lousyUUID(length=32): string {
	const parts: string[] = new Array(length);
	const now = Date.now();
	for (let i = 0; i < length; i++) {
		parts[i] = alphabet[Math.floor((now+i) * Math.random()) % alphabetLength];
	}
	return parts.join('');
}
