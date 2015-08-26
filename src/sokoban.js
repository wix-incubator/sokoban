import DockerContainer from './docker-container';
import Promise from 'promise';
import _ from 'lodash';
import retry from 'qretry';
import winston from 'winston';

function Sokoban() {
    this.containers = {};
}

Sokoban.prototype.provision = function(imageTag, containerName) {
    this.containers[containerName] = new DockerContainer(imageTag, containerName);
    this.containers[containerName].pullIfNeeded();
};

Sokoban.prototype.run = function({containerName, ports, env, barrier, volumes, links, maxRetries, delayInterval}) {

    const container = this.containers[containerName];
    const host = container.host();

    barrier = barrier || function() {};
    maxRetries = maxRetries || 5;

    return container.run({ports, env, volumes, links})
        .then(() => retry(() => barrier(host), {maxRetry: maxRetries, interval: delayInterval || 1000, intervalMultiplicator: 1.2}))
        .then(
            () => {
                const containerInfo = {host};
                winston.debug(containerName, "ready, returning container info", containerInfo);
                return containerInfo;
                },
            e => {
                winston.error(containerName, "not ready after", maxRetries, "attempts, error is", e);
                throw e;
            }
        );
};

Sokoban.prototype.dumpAllLogs = function() {
    return _.reduce(this.containers, (promise, container) => promise.then(container.printLogs()), Promise.resolve());
};

Sokoban.prototype.killAll = function() {
    return Promise.all(_.map(this.containers, c => c.kill()));
};

export default Sokoban;