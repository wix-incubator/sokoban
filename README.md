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

Instantiate in your test code and run containers once in a `before` hook, then call `killAll` in an `after` hook.

### Getting Started

```js
const Sokoban = require('sokoban');
const sokoban = new Sokoban();

sokoban.run({imageName: "hello-world", containerName: "hello"});
```

#### Dude, where's my Docker?
Being a TDD-supporting project, Sokoban is meant to run on multiple types of environments: Linux, OS X, Windows and from inside other Docker containers (for instance, in CI environment).
Since the major part of containers running on Sokoban are servers, we need Sokoban to be able to tell us the host and port where we can access these servers.
Unfortunately, finding out the host to which the containers are bound is trickier than you might initially think, and it depends on when Sokoban (or the test running Sokoban) is executed. This could be:

* `localhost` - if the tests are running on the same machine where Docker is running; this could be either on a Linux dev machine, or in CI, if the same machine happens to be running both Docker and the CI agent iteslf.
* `process.env.DOCKER_HOST` - on an OS X or Windows dev machine, this environment variable will point to the Docker Machine IP address.
* Queryable by calling `ip route` and looking for the default gateway - but only if we're running inside a Docker container 
* completely unknown 
 
Sokoban will attempt to resolve using the `DOCKER_HOST` environment variable, then by calling `ip route`, but if you know the IP of your Docker host it's best to pass it when instantiating Sokoban:
```js
const sokoban = new Sokoban({hostname: "my.docker.host"});
```

#### Randomizing container names
By default, if you do not specify container names, Docker will choose them for you. Sokoban mandates that you specify a name - to make linking containers less painful, and to aid you in reading the app logs.
However, when running multiple tests on the same Docker host, you could end up with a name collision - for instance, if two tests attempt to create a container named `redis`. 
Sokoban solves this by adding a random suffix to the container name, if the `randomizeNames` option is turned on:

```
const sokoban = new Sokoban({randomizeNames: true});
```

### Running a container
`Sokoban.run()` takes an options object with the following properties, and returns a promise, to be resolved when the container has started.
* `imageName` - mandatory, the image to run. 
* `containerName` - mandatory, the container to run.
* `ports` - an object describing a single TCP port binding with `from` and `to` properties
* `publishAllPorts` - instead of using `ports`, you can specify this property, which instructs Docker to bind all exposed ports to randomly-allocated ports 
* `volumes` - an mapping of volumes to bind 
* `links` - an object describing links to other containers
* `env` - an object where keys represent environment variable names and values represent their respective values, to be passed to the container upon startup
* `barrier` - a function that checks that the container has finished starting up. The `run` function will not resolve the promise until this barrier function returned successfully (i.e. did not throw an exception)
* `maxRetries` - how many times to retry on the barrier before giving up

### Examples

#### Running GitLab with Redis and Postgres:
```js
const db = "postgresql-gitlab";
const cache = "redis-gitlab";
const app = "gitlab";
    
return Promise.join(
    sokoban.run({imageName: "quay.io/sameersbn/postgresql:latest",
                 containerName: db,
                 volumes: {"/srv/docker/gitlab/postgresql": "/var/lib/postgresql"},
                 env: {DB_NAME: "gitlabhq_production", DB_USER: "gitlab", DB_PASS: "password"}}),

    sokoban.run({imageName: "quay.io/sameersbn/redis:latest", 
                 containerName: cache, 
                 volumes: {"/srv/docker/gitlab/redis": "/var/lib/redis"}}),

  (dbInfo, cacheInfo) => sokoban.run({
      imageName: "quay.io/sameersbn/gitlab:latest",
      containerName: app,
      publishAllPorts: true,
      links: linksFor(dbInfo, cacheInfo),
      env: {GITLAB_SECRETS_DB_KEY_BASE: "foobar"}
  })
);

function linksFor(postgresInfo, redisInfo) {
    const links = {};
    // the values are the link names as expected by the Gitlab image
    links[postgresInfo.containerName] = "postgresql"; 
    links[redisInfo.containerName] = "redisio";
    return links;
}
```              

(Setup taken from https://github.com/sameersbn/docker-gitlab)

## Contribution
This project is _very_ early stage and is under heavy development. Please feel free to open issues for any missing functionality, etc.

