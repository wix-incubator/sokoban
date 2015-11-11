import Docker from 'dockerode-promise';
import DockerContainer from './docker-container';
import Promise from 'bluebird';
import _ from 'lodash';
import retry from 'bluebird-retry';
import IpResolver from './docker-host-ip-resolver';

const debug = require('debug')('sokoban');

const Defaults = {randomizeNames: false};

//TODO kill using event emitter?
function Sokoban(options) {
    if (typeof options !== 'object') {
        options = {hostname: options};
    }

    this.options = _.assign(Defaults, options);
    this.containers = [];
    this.ipResolver = new IpResolver(options.hostname);

    // this is because in CI we must use sock explicitly, while in OSX this doesn't work
    this._docker = ~['darwin', 'win32'].indexOf(process.platform) ? new Docker() : new Docker({socketPath: '/var/run/docker.sock'});

    this.images = {};
}

Sokoban.prototype.dockerHostName = function () {
    return this.ipResolver.resolve();
}

Sokoban.prototype.run = function ({imageName, containerName, ports, publishAllPorts, env, barrier, volumes, links, maxRetries, delayInterval}) {

    if (!imageName) {
        throw new Error(`Container '${containerName}' not provisioned`);
    }

    this.pullImage(imageName);

    const container = new DockerContainer({
        docker: this._docker,
        imageName,
        containerName,
        randomizeNames: this.options.randomizeNames
    });

    this.containers.push(container);

    const host = this.ipResolver.resolve();

    if (!host) {
        return Promise.reject("Could not resolve Docker hostname");
    } else {
        barrier = barrier || function () {};
        maxRetries = maxRetries || 5;

        return container.run({ports, publishAllPorts, env, volumes, links})
            .then(() => Promise.delay(100)) //TODO remove me ASAP
            .then(() => container.getState())
            .then(state => {
                debug("State", state);
                if (!state.Running && state.ExitCode) {
                    throw new Error(`Container ${containerName} exited with code ${state.ExitCode}`);
                }
            })
            .then(() => container.getPortMappings())
            .then(portMappings => {
                return retry(() => barrier(host, portMappings), {
                    max_tries: maxRetries,
                    interval: delayInterval || 1000,
                    backoff: 1.2
                })
            .then(() => {
                const containerInfo = {host, portMappings, containerName: container.containerName};
                debug(containerName, "ready, returning container info", containerInfo);
                return containerInfo;
            })
            })
            .catch(e => {
                debug(containerName, "not ready after", maxRetries, "attempts, error is", e);
                throw e;
            })

    }
};

Sokoban.prototype.dumpAllLogs = function () {
    return _.reduce(this.containers, (promise, container) => promise.then(() => container.printLogs()), Promise.resolve());
};

Sokoban.prototype.killAll = function () {
    return Promise.all(_.map(this.containers, c => c.kill()));
};

Sokoban.prototype.pullImage = function pullImage(imageName) {
    if (!this.images[imageName]) {
        const onComplete = stream => new Promise((resolve, reject) => {
            const onFinished = (err, output) => {
                if (err) {
                    debug("pull failed with error", err);
                    reject(err);
                } else {
                    debug("pull complete for image", imageName);
                    resolve(output);
                }
            }

            const onProgress = event => debug("pull.onProgress", imageName, event);

            this._docker.$subject.modem.followProgress(stream, onFinished, onProgress);
        });

        this.images[imageName] = this._docker.listImages({filter: imageName})
            .then(images => {
                if (images.length) {
                    debug("image", imageName, "found locally; not pulling");
                    return Promise.resolve();
                } else {
                    debug("pulling image", imageName);
                    return this._docker.pull(imageName).then(onComplete, logAndThrow(["failed pulling image", imageName]));
                }
            });
    }

    return this.images[imageName];

}

function logAndThrow(args) {
    return function (e) {
        debug(...args, e);
        throw e;
    }
}

export default Sokoban;