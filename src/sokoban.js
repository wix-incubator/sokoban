import DockerContainer from './docker-container';
import Promise from 'bluebird';
import _ from 'lodash';
import retry from 'bluebird-retry';
import IpResolver from './docker-host-ip-resolver';

const debug = require('debug')('sokoban');

const Defaults = {randomizeNames: false};

//TODO move 'pull' here, hold a dictionary of images currently being pulled separately from instantiated containers
//TODO kill using event emitter?
function Sokoban(options) {
    if (typeof options !== 'object') {
        options = {hostname: options};
    }

    this.options = _.assign(options, Defaults);
    this.containers = {};
    this.ipResolver = new IpResolver(options.hostname);

}

Sokoban.prototype.dockerHostName = function () {
    return this.ipResolver.resolve();
}

Sokoban.prototype.provision = function (imageName, containerName) {
    this.containers[containerName] = new DockerContainer({
        imageName,
        containerName,
        randomizeNames: this.options.randomizeNames
    });
    this.containers[containerName].pullIfNeeded();
};

Sokoban.prototype.run = function ({containerName, ports, publishAllPorts, env, barrier, volumes, links, maxRetries, delayInterval}) {

    const container = this.containers[containerName];

    if (!container) {
        throw new Error(`Container '${containerName}' not provisioned`);
    }

    const host = this.ipResolver.resolve();

    if (!host) {
        return Promise.reject("Could not resolve Docker hostname");
    } else {
        barrier = barrier || function () {};
        maxRetries = maxRetries || 5;

        return container.run({ports, publishAllPorts, env, volumes, links})
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

export default Sokoban;