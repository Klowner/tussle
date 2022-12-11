# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
