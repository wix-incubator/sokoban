import DockerContainer from './docker-container';
import Promise from 'bluebird';
import _ from 'lodash';
import retry from 'bluebird-retry';
import IpResolver from './docker-host-ip-resolver';

const debug = require('debug')('sokoban');

function Sokoban(maybeHostname) {
    this.containers = {};
    this.ipResolver = new IpResolver(maybeHostname);

}

Sokoban.prototype.dockerHostName = function() {
    return this.ipResolver.resolve();
}

Sokoban.prototype.provision = function(imageTag, containerName) {
    this.containers[containerName] = new DockerContainer(imageTag, containerName);
    this.containers[containerName].pullIfNeeded();
};

Sokoban.prototype.run = function({containerName, ports, env, barrier, volumes, links, maxRetries, delayInterval}) {

    const container = this.containers[containerName];
    const host = this.ipResolver.resolve();

    if (!host) {
        return Promise.reject("Could not resolve Docker hostname");
    } else {
        barrier = barrier || function () {
            };
        maxRetries = maxRetries || 5;

        return container.run({ports, env, volumes, links})
            .then(() => retry(() => barrier(host), {
                max_tries: maxRetries,
                interval: delayInterval || 1000,
                backoff: 1.2
            }))
            .then(
            () => {
                const containerInfo = {host};
                debug(containerName, "ready, returning container info", containerInfo);
                return containerInfo;
            },
            e => {
                debug(containerName, "not ready after", maxRetries, "attempts, error is", e);
                throw e;
            }
        );
    }
};

Sokoban.prototype.dumpAllLogs = function() {
    return _.reduce(this.containers, (promise, container) => promise.then(() => container.printLogs()), Promise.resolve());
};

Sokoban.prototype.killAll = function() {
    return Promise.all(_.map(this.containers, c => c.kill()));
};

export default Sokoban;