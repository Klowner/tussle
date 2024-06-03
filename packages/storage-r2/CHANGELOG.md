# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.7.7](https://github.com/Klowner/tussle/compare/v0.7.6...v0.7.7) (2024-06-03)


### Bug Fixes

* **storage-r2:** fix FixedLengthStream did not see all expected bytes when using checkpointMaxBufferSize ([6d9b1ba](https://github.com/Klowner/tussle/commit/6d9b1bad067bc435018e5859985a997487b34da7))





## [0.7.6](https://github.com/Klowner/tussle/compare/v0.7.5...v0.7.6) (2024-05-29)

**Note:** Version bump only for package @tussle/storage-r2





## [0.7.5](https://github.com/Klowner/tussle/compare/v0.7.4...v0.7.5) (2024-05-29)


### Bug Fixes

* **storage-r2:** ensure state reconstruction picks the higher value key of two equally-timed uploads ([82b035a](https://github.com/Klowner/tussle/commit/82b035a238f0188a01794775f5f4d50b0e0c243e))


### Features

* **core,storage-r2:** add basic support for termination protocol extension ([f544ffd](https://github.com/Klowner/tussle/commit/f544ffd0a68ac7fa0066651e7ef97f0f17a0e3fc))
* **storage-r2:** add option to limit working buffer size of checkpoint ReadableStream slicer ([c87e507](https://github.com/Klowner/tussle/commit/c87e507221109755d8c30ae47347237e6b5ef11b))





## [0.7.4](https://github.com/Klowner/tussle/compare/v0.7.3...v0.7.4) (2023-06-15)


### Bug Fixes

* **storage-r2:** update rebucket error callback types ([6ec4e81](https://github.com/Klowner/tussle/commit/6ec4e81ef078c157392b08df7050dff406e0184c))





## [0.7.3](https://github.com/Klowner/tussle/compare/v0.7.2...v0.7.3) (2023-06-15)


### Bug Fixes

* **storage-r2:** avoid predicted future state, rebuild state from known truths only ([67fd69b](https://github.com/Klowner/tussle/commit/67fd69b0cf6cb2628229f8866543666db77b73b8))


### Features

* **storage-r2:** add internal state as second parameter to ReBucket error callback ([08adb58](https://github.com/Klowner/tussle/commit/08adb58d4c85f3763bb09ef242d0b9b073cd728b))
* **storage-r2:** move R2File.body() optimizations to R2File.slice(), body() now calls slice() ([9ef0834](https://github.com/Klowner/tussle/commit/9ef083475cf51f3159d78923ffbb8a5b12d88c92))
* upgrade miniflare to 3.0.1 ([e5440a9](https://github.com/Klowner/tussle/commit/e5440a965d8f0441decfa074efb0d04fd7432441))





## [0.7.2](https://github.com/Klowner/tussle/compare/v0.7.1...v0.7.2) (2023-05-28)


### Bug Fixes

* **storage-r2:** automerge and parallel/concatenation requests should now interop as expected ([eb2b41f](https://github.com/Klowner/tussle/commit/eb2b41f4f8384b006246e098056831236e6e592c))





## [0.7.1](https://klowner/compare/v0.7.0...v0.7.1) (2023-05-09)

**Note:** Version bump only for package @tussle/storage-r2





# [0.7.0](https://klowner/compare/v0.6.12...v0.7.0) (2023-05-09)


### Bug Fixes

* **storage-r2:** Update README.md ([bc1df27](https://klowner/commits/bc1df27f7c6532b8bbcbc111eedcce6dd7d9e279))
* **storage-r2:** use etagMatches: 'never-match' to avoid R2 body response (docs claim lower latency) ([add2ca0](https://klowner/commits/add2ca031c6cec00327cfa898df20bb521715444))


### Features

* **storage-r2:** add documentation for skipMerge ([8c6417f](https://klowner/commits/8c6417f03b314abc3b0856831969525232f8517d))
* **storage-r2:** add majority of support for auto-merge upon upload completion ([b08939f](https://klowner/commits/b08939fddecb87cb1156db669c902f8202430409))
* **storage-r2:** add test coverage for checkpoints ([e7a4146](https://klowner/commits/e7a41461755627be7dad566229d12720b69a288b))
* **storage-r2:** add tests for auto-merge ([91489fb](https://klowner/commits/91489fba83efae8d5658be8a2ed1c80205a01766))





## [0.6.12](https://github.com/Klowner/tussle/compare/v0.6.11...v0.6.12) (2023-03-28)

**Note:** Version bump only for package @tussle/storage-r2





## [0.6.11](https://github.com/Klowner/tussle/compare/v0.6.10...v0.6.11) (2023-02-06)


### Bug Fixes

* **storage-r2:** disable R2 put() retries in ReBucket until I find a strategy for retrying already-read ReadableStreams ([2423991](https://github.com/Klowner/tussle/commit/2423991bde1fc744e0ca6c5320a43b36319e195d))





## [0.6.10](https://github.com/Klowner/tussle/compare/v0.6.9...v0.6.10) (2023-02-01)


### Features

* **storage-r2:** add optional 'ReBucket' adapter class to provide automatic retry for R2 bucket operations ([fc0bb2c](https://github.com/Klowner/tussle/commit/fc0bb2c86244b8d2a8e4c8a16cf4653290cdd1fa))
* **storage-r2:** add test for lousyUUID default params ([01720ca](https://github.com/Klowner/tussle/commit/01720ca5c793be03a526fbaab3f42894d1f29706))





## [0.6.9](https://github.com/Klowner/tussle/compare/v0.6.8...v0.6.9) (2023-01-15)


### Features

* **storage-r2:** remove nanoid in favor of built-in lousyUUID, also provide option for users to provide their own method (or use nanoid) ([651a89e](https://github.com/Klowner/tussle/commit/651a89eddf6b04fa8935d7fcfe9c5b983fa1b0ba))





## [0.6.8](https://github.com/Klowner/tussle/compare/v0.6.7...v0.6.8) (2022-12-15)


### Bug Fixes

* **storage-r2:** calculate R2File size from sum of chunk sizes ([68d914a](https://github.com/Klowner/tussle/commit/68d914a1af70345855658b1439c059fc054c9661))





## [0.6.7](https://klowner/compare/v0.6.6...v0.6.7) (2022-12-11)


### Bug Fixes

* **storage-r2:** fix race-condition causing file reassembly to potentially scramble chunk order ([0137528](https://klowner/commits/01375282333af4a7b7268f19ff30783bb8ab4ad9))





## [0.6.6](https://github.com/Klowner/tussle/compare/v0.6.5...v0.6.6) (2022-12-10)


### Bug Fixes

* **storage-r2:** only check upload-length during concatenation if it's provided (spec says it's optional) ([5bd7436](https://github.com/Klowner/tussle/commit/5bd74368a6b974cc1336d7086faff2575915b030))





## [0.6.5](https://github.com/Klowner/tussle/compare/v0.6.4...v0.6.5) (2022-12-06)


### Bug Fixes

* **storage-r2:** add a ton of tests, hopefully fix parallel upload state reconstruction ([585fa9d](https://github.com/Klowner/tussle/commit/585fa9dd19f31c6034b354a800c4d443eb02e278))


### Features

* **storage-r2:** update R2File.delete() to use single call to bucket.delete() now that it accepts arrays ([1a56397](https://github.com/Klowner/tussle/commit/1a56397f0d6d1c717b018192a4cc22dc3a1639d3))





## [0.6.4](https://github.com/Klowner/tussle/compare/v0.6.3...v0.6.4) (2022-11-15)

**Note:** Version bump only for package @tussle/storage-r2





## [0.6.3](https://github.com/Klowner/tussle/compare/v0.6.2...v0.6.3) (2022-11-15)

**Note:** Version bump only for package @tussle/storage-r2





## [0.6.2](https://klowner/compare/v0.6.1...v0.6.2) (2022-11-11)


### Bug Fixes

* **storage-r2:** cap R2File.slice() length to file's total size ([29b33fd](https://klowner/commits/29b33fd22e2ddad066650d6353f873cf0aa75685))





## [0.6.1](https://github.com/Klowner/tussle/compare/v0.6.0...v0.6.1) (2022-11-09)


### Features

* **storage-r2:** add slice method to R2File (ranged-reads from or dered R2 record keys) ([b3c6f3a](https://github.com/Klowner/tussle/commit/b3c6f3acb74482198c78955afff7b6b4577059ac))





# [0.6.0](https://github.com/Klowner/tussle/compare/v0.5.4...v0.6.0) (2022-11-03)


### Bug Fixes

* **storage-r2:** remove @tussle/core type imports in favor of @tussle/spec ([9d9b5d2](https://github.com/Klowner/tussle/commit/9d9b5d2318186fa9c0feede779a653f8a1361c7d))


### Features

* **storage-r2:** add split builds ([a4c5975](https://github.com/Klowner/tussle/commit/a4c5975270f2da214cbc1f30f196e3650f71ba73))





## [0.5.4](https://github.com/Klowner/tussle/compare/v0.5.3...v0.5.4) (2022-10-28)


### Bug Fixes

* **spec:** add offset requirement to TussleStorageCreateFileResponse interface ([ff8f45b](https://github.com/Klowner/tussle/commit/ff8f45b7d2f0ddae174016052dd3c8e7b3595b52))





## [0.5.3](https://github.com/Klowner/tussle/compare/v0.5.2...v0.5.3) (2022-10-28)


### Bug Fixes

* **storage-r2:** Store empty record (with metadata) in R2 upon initial creation. ([ed27a30](https://github.com/Klowner/tussle/commit/ed27a3067374920885af24882d72da6fa054f36e))





## [0.5.2](https://github.com/Klowner/tussle/compare/v0.5.1...v0.5.2) (2022-10-27)


### Bug Fixes

* **storage-r2:** remove static qualifier from supportedExtensions so core can actually pick it up. ([a48626b](https://github.com/Klowner/tussle/commit/a48626bcdaf713ebca3b53f5f9f3afc00e1f5c50))





## [0.5.1](https://github.com/Klowner/tussle/compare/v0.5.0...v0.5.1) (2022-10-26)

**Note:** Version bump only for package @tussle/storage-r2





# [0.5.0](https://github.com/Klowner/tussle/compare/v0.4.5...v0.5.0) (2022-10-26)


### Features

* **storage-r2:** Add auto-checkpoint feature for non-chunked uploads ([b1e035d](https://github.com/Klowner/tussle/commit/b1e035d9fc1a46cb63e395dea5ccaa124e095c00))





## [0.4.5](https://github.com/Klowner/tussle/compare/v0.4.4...v0.4.5) (2022-10-08)

**Note:** Version bump only for package @tussle/storage-r2





## [0.4.3](https://github.com/Klowner/tussle/compare/v0.4.2...v0.4.3) (2022-10-07)

**Note:** Version bump only for package @tussle/storage-r2





## [0.4.1](https://github.com/Klowner/tussle/compare/v0.4.0...v0.4.1) (2022-10-07)

**Note:** Version bump only for package @tussle/storage-r2





# [0.4.0](https://github.com/Klowner/tussle/compare/v0.3.2...v0.4.0) (2022-10-07)

**Note:** Version bump only for package @tussle/storage-r2





## [0.3.2](https://github.com/Klowner/tussle/compare/v0.3.1...v0.3.2) (2022-09-15)

**Note:** Version bump only for package @tussle/storage-r2





# [0.3.0](https://github.com/Klowner/tussle/compare/v0.2.13...v0.3.0) (2022-09-14)

**Note:** Version bump only for package @tussle/storage-r2





## [0.2.13](http://klowner/tussle/compare/v0.2.12...v0.2.13) (2022-07-19)

**Note:** Version bump only for package @tussle/storage-r2





## [0.2.9](https://github.com/Klowner/tussle/compare/v0.2.8...v0.2.9) (2022-07-06)

**Note:** Version bump only for package @tussle/storage-r2





## [0.2.8](https://github.com/Klowner/tussle/compare/v0.2.7...v0.2.8) (2022-07-05)

**Note:** Version bump only for package @tussle/storage-r2
