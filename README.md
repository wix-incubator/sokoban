# Sokoban

[![NPM](https://nodei.co/npm/sokoban.png?mini=true)](https://nodei.co/npm/sokoban/)

Sokoban moves Docker containers around. Meant for usage in an E2E testing environment.
*Note*: Sokoban was written to aid in testing Docker-based systems and was not tested in production.

## Installation

`npm install sokoban`

## Usage

Instantiate in your test code, provision and run containers once in a `before` hook, then call `killAll` in an `after` hook.

# Getting Started

```js
var Sokoban = require('sokoban');
var sokoban = new Sokoban();

sokoban.provision("hello-world", "hello");
sokoban.run({containerName: "hello");
```

## Contribution
This project is _very_ early stage and is undere heavy development. Please feel free to open issues for any missing functionality, etc.

