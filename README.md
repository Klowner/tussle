<p align="center">
  <img src="../../raw/main/assets/tusslekitty.svg"/>
</p>

# Tussle
Tussle is a *mostly* spec-compliant server implementation of the [tus upload protocol](http://www.tus.io/protocols/resumable-upload.html).

[![CircleCI](https://circleci.com/gh/Klowner/tussle.svg?style=shield)](https://circleci.com/gh/Klowner/tussle)
[![Coverage Status](https://coveralls.io/repos/github/Klowner/tussle/badge.svg?branch=main)](https://coveralls.io/github/Klowner/tussle?branch=main)

## Component based
Tussle is implemented as a collection of interchangeable modular components, allowing the developer to choose which services that they'd like to integrate with.
At the center of a Tussle instance is the *Tussle Core*, which handles all communication between individual components.

## Components
### Middleware
Middleware components handle communication between clients and the Tussle instance.
 - [middleware-koa](/packages/middleware-koa) - mount a Tussle server as a Koa route handler.
 - [middleware-cloudflareworker](/packages/middleware-cloudflareworker) - run Tussle server in a cloudflare worker.

### State
Tracking state is tricky and often your options are limited by your deployment environment.
Tussle state components are modeled after the [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API)
 - [state-memory](/packages/state-memory) - simple in-memory store, works anywhere.
 - [state-memory-ttl](/packages/state-memory-ttl) - in-memory store with TTL record expiration, works anywhere.
 - [state-namespace](/packages/state-namespace) - wrapper to add transparent key prefixing for other stores.
 - [state-postgres](/packages/state-postgres) - store upload state in a PostgreSQL database.
 - [state-cloudflareworkerkv](/packages/state-cloudflareworkerkv) - store upload state in Cloudflare Workers KV.

### Storage
Uploaded files have to be stored somewhere, that's the purpose of the *storage* components.
 - [storage-b2](/packages/storage-b2) - Backblaze B2 cloud storage (supports large file upload)
 - [storage-s3](/packages/storage-s3) - AWS S3 compatible cloud storage (supports large file upload)
 - [storage-r2](/packages/storage-r2) - Cloudflare R2 cloud storage (supports large file upload, ^0.4.0 adds parallel support)

### Request
The request component a responsible for creating outbound HTTP requests and -- when possible/appropriate -- transparently proxy upload payloads, which is determined by the *storage* component.
 - [request-axios](/packages/request-axios) - Use [Axios](https://github.com/axios/axios), suitable for node environments.
 - [request-cloudflareworker](/packages/request-cloudflareworker) - Use [Cloudflare Worker's Fetch()](https://developers.cloudflare.com/workers/runtime-apis/fetch) (for use with [middleware-cloudflareworker](/packages/middleware-cloudflareworker)).

### Support me
If you find this library useful, please consider buying me a coffee as a way of showing your support!
[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/mark.riedesel)
