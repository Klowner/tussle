<p align="center">
  <img src="../../raw/main/assets/tusslekitty.svg"/>
</p>

# Tussle
Tussle is a *mostly* spec-compliant server implementation of the [tus upload protocol](http://www.tus.io/protocols/resumable-upload.html).

[![Build Status](https://travis-ci.org/Klowner/tussle.svg?branch=main)](https://travis-ci.org/Klowner/tussle)
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
 - [state-memory](/packages/state-memory) - simple in-memory store, works anywhere
 - [state-postgres](/packages/state-postgres) - store upload state in a PostgreSQL database
 
### Storage
Uploaded files have to be stored somewhere, that's the purpose of the *storage* components.
 - [storage-b2](/packages/storage-b2) - Backblaze B2 cloud storage (supports large file upload)

### Request
The request component a responsible for creating outbound HTTP requests and -- when possible/appropriate -- transparently proxy upload payloads, which is determined by the *storage* component.
 - [request-axios](/packages/request-axios) - Use [Axios](https://github.com/axios/axios), suitable for node environments.
 - [request-cloudflareworker](/packages/request-cloudflareworker) - Use [Cloudflare Worker's Fetch()](https://developers.cloudflare.com/workers/runtime-apis/fetch) (for use with [middleware-cloudflareworker](/packages/middleware-cloudflareworker)).
