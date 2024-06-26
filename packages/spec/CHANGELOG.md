# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.7.9](https://github.com/Klowner/tussle/compare/v0.7.8...v0.7.9) (2024-06-06)


### Features

* **spec:** add TussleStoragePerfEvent and optional event$ Observable to TussleStorageService ([3b80854](https://github.com/Klowner/tussle/commit/3b80854584724f39d255fd83414a902d1d07c2ac))





## [0.7.6](https://github.com/Klowner/tussle/compare/v0.7.5...v0.7.6) (2024-05-29)

**Note:** Version bump only for package @tussle/spec





## [0.7.5](https://github.com/Klowner/tussle/compare/v0.7.4...v0.7.5) (2024-05-29)


### Features

* add middleware test for tus Upload-Metadata header ([80a57a7](https://github.com/Klowner/tussle/commit/80a57a7ce4385a3038953a080e36f7a9a7c06f26))
* **core,storage-r2:** add basic support for termination protocol extension ([f544ffd](https://github.com/Klowner/tussle/commit/f544ffd0a68ac7fa0066651e7ef97f0f17a0e3fc))
* **spec:** add TussleStorageServiceWithDeleteCapability type which includes deleteFile() ([5298280](https://github.com/Klowner/tussle/commit/5298280b551ab6184ded3c7545c2a5bb82b528ef))





# [0.7.0](https://klowner/compare/v0.6.12...v0.7.0) (2023-05-09)


### Features

* **core:** add (hopefully) functional creation-with-upload implementation ([93460c1](https://klowner/commits/93460c14c337b9b9bc2ccc4565db2a5ac01d8697))
* **storage-r2:** add test coverage for checkpoints ([e7a4146](https://klowner/commits/e7a41461755627be7dad566229d12720b69a288b))





## [0.6.12](https://github.com/Klowner/tussle/compare/v0.6.11...v0.6.12) (2023-03-28)

**Note:** Version bump only for package @tussle/spec





## [0.6.11](https://github.com/Klowner/tussle/compare/v0.6.10...v0.6.11) (2023-02-06)


### Bug Fixes

* **storage-r2:** disable R2 put() retries in ReBucket until I find a strategy for retrying already-read ReadableStreams ([2423991](https://github.com/Klowner/tussle/commit/2423991bde1fc744e0ca6c5320a43b36319e195d))





## [0.6.5](https://github.com/Klowner/tussle/compare/v0.6.4...v0.6.5) (2022-12-06)


### Bug Fixes

* **storage-r2:** add a ton of tests, hopefully fix parallel upload state reconstruction ([585fa9d](https://github.com/Klowner/tussle/commit/585fa9dd19f31c6034b354a800c4d443eb02e278))





## [0.6.4](https://github.com/Klowner/tussle/compare/v0.6.3...v0.6.4) (2022-11-15)

**Note:** Version bump only for package @tussle/spec





## [0.6.3](https://github.com/Klowner/tussle/compare/v0.6.2...v0.6.3) (2022-11-15)


### Features

* **spec:** add x-http-method-override header http verb override to middleware tests ([f08f89d](https://github.com/Klowner/tussle/commit/f08f89d727c10894bfa0cd731879c58b8471c866))





## [0.6.1](https://github.com/Klowner/tussle/compare/v0.6.0...v0.6.1) (2022-11-09)

**Note:** Version bump only for package @tussle/spec





# [0.6.0](https://github.com/Klowner/tussle/compare/v0.5.4...v0.6.0) (2022-11-03)


### Bug Fixes

* **core:** handler throws error if Upload-Length missing ([8d258b5](https://github.com/Klowner/tussle/commit/8d258b51c512322bee4e67065b8c7c0630f6b11f))





## [0.5.4](https://github.com/Klowner/tussle/compare/v0.5.3...v0.5.4) (2022-10-28)


### Bug Fixes

* **spec:** add offset requirement to TussleStorageCreateFileResponse interface ([ff8f45b](https://github.com/Klowner/tussle/commit/ff8f45b7d2f0ddae174016052dd3c8e7b3595b52))





# [0.5.0](https://github.com/Klowner/tussle/compare/v0.4.5...v0.5.0) (2022-10-26)

**Note:** Version bump only for package @tussle/spec





## [0.4.5](https://github.com/Klowner/tussle/compare/v0.4.4...v0.4.5) (2022-10-08)

**Note:** Version bump only for package @tussle/spec





# [0.4.0](https://github.com/Klowner/tussle/compare/v0.3.2...v0.4.0) (2022-10-07)

**Note:** Version bump only for package @tussle/spec





# [0.3.0](https://github.com/Klowner/tussle/compare/v0.2.13...v0.3.0) (2022-09-14)

**Note:** Version bump only for package @tussle/spec





## [0.2.13](http://klowner/tussle/compare/v0.2.12...v0.2.13) (2022-07-19)

**Note:** Version bump only for package @tussle/spec





## [0.2.5](https://github.com/Klowner/tussle/compare/v0.2.4...v0.2.5) (2022-05-05)

**Note:** Version bump only for package @tussle/spec





## [0.2.2](https://github.com/Klowner/tussle/compare/v0.2.1...v0.2.2) (2022-04-28)

**Note:** Version bump only for package @tussle/spec





# [0.2.0](https://github.com/Klowner/tussle/compare/v0.1.1...v0.2.0) (2022-04-22)

**Note:** Version bump only for package @tussle/spec





# [0.1.0](https://github.com/Klowner/tussle/compare/v0.0.5...v0.1.0) (2022-04-05)

**Note:** Version bump only for package @tussle/spec





## [0.0.5](https://github.com/Klowner/tussle/compare/v0.0.4...v0.0.5) (2021-05-10)

**Note:** Version bump only for package @tussle/spec





## [0.0.4](https://github.com/Klowner/tussle/compare/v0.0.3...v0.0.4) (2021-02-11)

**Note:** Version bump only for package @tussle/spec





## [0.0.3](https://github.com/Klowner/tussle/compare/v0.0.2...v0.0.3) (2020-11-28)

**Note:** Version bump only for package @tussle/spec





## [0.0.2](https://github.com/Klowner/tussle/compare/v0.0.1...v0.0.2) (2020-11-19)

**Note:** Version bump only for package @tussle/spec
