import Docker from 'dockerode-promise';
import url from 'url';
import Promise from 'bluebird';
import readline from 'readline';
import colors from 'colors/safe';
import _ from 'lodash';
import through from 'through';
import {parsePorts} from './inspect-parser';

const debug = require('debug')('sokoban:DockerContainer');


function logAndThrow(args) {
    return function (e) {
        debug(...args, e);
        throw e;
    }
}

function DockerContainer(options) {

    // this is because in CI we must use sock explicitly, while in OSX this doesn't work
    this._docker = ~['darwin', 'win32'].indexOf(process.platform) ? new Docker() : new Docker({socketPath: '/var/run/docker.sock'});

    this.imageName = options.imageName;
    this.containerName = options.randomizeNames ? addRandomSuffixTo(options.containerName) : options.containerName;
    this.options = options;

    this._container = undefined;
    this.pullResult = Promise.resolve();
}

DockerContainer.prototype.pullIfNeeded = function() {

    const onComplete = stream => new Promise((resolve, reject) => {
        const onFinished = (err, output) => {
            if (err) {
                debug("pull failed with error", err);
                reject(err);
            } else {
                debug("pull complete for image", this.imageName);
                resolve(output);
            }
        }

        const onProgress = event => debug("pull.onProgress", this.imageName, event);

        this._docker.$subject.modem.followProgress(stream, onFinished, onProgress);
    });

    this.pullResult = this._docker.listImages({filter: this.imageName})
        .then(images => {
            if (images.length) {
                debug("image", this.imageName, "found locally; not pulling");
                return Promise.resolve();
            } else {
                debug("pulling image", this.imageName);
                return this._docker.pull(this.imageName).then(onComplete, logAndThrow(["failed pulling image", this.imageName]));
            }
        });

}

DockerContainer.prototype.run = function ({ports, env, volumes, links, publishAllPorts}) {
    const create = () => {
        const options = {
            Image: this.imageName,
            name: this.containerName,
            Env: _.map(env, (v, k) => `${k}=${v}`),
            Volumes: _.mapValues(volumes, () => ({})),
            HostConfig: {
                PublishAllPorts: !!publishAllPorts,
                Links: _.map(links, (v, k) => `${k}:${v}`),
                Binds: _.map(volumes, (v, k) => `${v}:${k}`),
            },
        }

        debug("creating container with options", options);

        return this._docker.createContainer(options);
    }

    const start = (container) => {
        const bindings = {};

        if (ports) {
            bindings[ports.from + "/tcp"] = [{"HostPort": "" + ports.to}];
        }

        const options = ports && {
            "PortBindings": bindings
        };

        debug("starting container from image", this.imageName, "with options", options);
        return container.start(options).then(() => {
            debug("container", this.containerName, "started");
            this._container = container;
        });
    }

    return this.pullResult
        .then(create, logAndThrow(["failed creating container for image", this.imageName]))
        .then(start, logAndThrow(["failed starting container for image", this.imageName]));
};

DockerContainer.prototype.isRunning = function() {
    return !!this._container;
}

DockerContainer.prototype.getPortMappings = function() {
    return this._container.inspect()
        .then(inspectResult => {debug("inspect results", inspectResult); return inspectResult})
        .then(({NetworkSettings: {Ports}}) => parsePorts(Ports));
};

DockerContainer.prototype.printLogs = function() {
    if (this._container) {
        debug("dumping logs for container", this.containerName);
        var color = ['red', 'green', 'yellow', 'blue'][Math.floor(Math.random() * 4)];
        return this.logs().then(logs => {
            logs.split('\n').map(line => {
                debug(colors[color](this.containerName), ":", line);
            });
        });
    } else {
        debug("Can't dump logs of non-started container", this.containerName, "from image", this.imageName);
    }
};

DockerContainer.prototype.logs = function () {
    if (this._container) {
        return this._container.logs({stdout: 1, stderr: 1})
            .then(muxedStream => new Promise((resolve, reject) => {
                let buffer = "";
                const ts = through(function (data) {
                    this.queue(data)
                }, function () {
                    this.queue(null)
                }).on('data', data => buffer += data);

                muxedStream.on('error', reject)
                    .on('end', () => resolve(buffer));

                this._docker.$subject.modem.demuxStream(muxedStream, ts, ts);

            }));
    } else {
        debug("Can't dump logs of non-started container", this.containerName, "from image", this.imageName);
    }
};

DockerContainer.prototype.kill = function () {
    if (this._container) {
        debug("killing container", this.containerName);

        return this._container.stop()
            .catch(e => debug("error stopping container", e))
            .then(() => this._container.remove());
    } else {
        debug("Not shutting down non-started container", this.containerName, "from image", this.imageName);
    }
};

function addRandomSuffixTo(containerName) {
    return containerName + "_" + Math.random().toString(16).substring(2);
}

export default DockerContainer;