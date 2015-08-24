import DockerContainer from '../src/docker-container';
import Promise from 'promise';
import _ from 'lodash';
import retry from 'qretry';
import winston from 'winston';

function Docherstrator() {
    var containers = {};

    this.provision = function(imageTag, containerName) {
        containers[containerName] = new DockerContainer(imageTag, containerName);
        containers[containerName].pullIfNeeded();
    };

    this.run = function({containerName, bindings, env, barrier, maxRetries}) {

        var container = containers[containerName];
        var host = container.host();

        return container.run(bindings || {}, env || [])
            .then(() => retry(() => barrier(host), {maxRetry: maxRetries || 5}))
            .then(
                () => {
                    var containerInfo = {host};
                    winston.debug(containerName, "ready, returning container info", containerInfo);
                    return containerInfo;
                    },
                (e) => {
                    winston.error(containerName, "not ready after", maxRetries, ", error is", e);
                    throw e;
                }
            );
    };

    this.dumpAllLogs = function() {
        return _.reduce(containers, (promise, container) => promise.then(container.printLogs()), Promise.resolve());
    };

    this.killAll = function() {
        return Promise.all(_.map(containers, c => c.kill()));
    };

};

export default Docherstrator;