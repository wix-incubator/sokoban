# Sokoban
[![Build Status](https://travis-ci.org/wix/sokoban.png)](https://travis-ci.org/wix/sokoban)

[![npm version](https://badge.fury.io/js/sokoban.svg)](http://badge.fury.io/js/sokoban)
[![Dependency Status](https://david-dm.org/wix/sokoban.svg)](https://david-dm.org/wix/sokoban)
[![devDependency Status](https://david-dm.org/wix/sokoban/dev-status.svg)](https://david-dm.org/wix/sokoban#info=devDependencies)

Sokoban moves Docker containers around. Meant for usage in an E2E testing environment.
*Note*: Sokoban was written to aid in testing Docker-based systems and was not tested in production.

## Installation

`npm install sokoban`

## Prerequisites

Docker needs to be installed and working on your local machine. Plesae follow the instructions on [the Docker website](https://docs.docker.com/installation), then make sure the installation was successful by running `docker run hello-world` from your terminal.

## Usage

Instantiate in your test code, provision and run containers once in a `before` hook, then call `killAll` in an `after` hook.

### Getting Started

```js
var Sokoban = require('sokoban');
var sokoban = new Sokoban();

sokoban.provision("hello-world", "hello");
sokoban.run({containerName: "hello"});
```

### Running a container
`Sokoban.run()` takes an options object with the following properties, and returns a promise, to be resolved when the container has started.
* `containerName` - mandatory, the container to run. Must have been provisioned earlier by calling `Sokoban.provision`
* `ports` - an object describing a single TCP port binding with `from` and `to` properties
* `env` - an object where keys represent environment variable names and values represent their respective values, to be passed to the container upon startup
* `barrier` - a function that checks that the container has finished starting up. The `run` function will not resolve the promise until this barrier function returned successfully (i.e. did not throw an exception)
* `maxRetries` - how many times to retry on the barrier before giving up

## Contribution
This project is _very_ early stage and is under heavy development. Please feel free to open issues for any missing functionality, etc.

