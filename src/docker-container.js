import Docker from 'dockerode-promise';
import url from 'url';
import Promise from 'promise';
import readline from 'readline';
import colors from 'colors/safe';
import winston from 'winston';
import _ from 'lodash';
import through from 'through';

function logAndThrow(args) {
    return function (e) {
        winston.error(...args, e);
        throw e;
    }
}

function DockerContainer(imageName, containerName) {

    // this is because in CI we must use sock explicitly, while in OSX this doesn't work
    this._docker = ~['darwin', 'win32'].indexOf(process.platform) ? new Docker() : new Docker({socketPath: '/var/run/docker.sock'});

    this.imageName = imageName;
    this.containerName = containerName;

    this._container = undefined;
    this.pullResult = Promise.resolve();
}

DockerContainer.prototype.pullIfNeeded = function () {

    const onComplete = stream => new Promise((resolve, reject) => {
        const onFinished = (err, output) => {
            if (err) {
                winston.error("DockerContainer: pull failed with error", err);
                reject(err);
            } else {
                winston.info("DockerContainer: pull complete for image", this.imageName);
                resolve(output);
            }
        }

        const onProgress = event => winston.silly("DockerContainer: pull.onProgress", this.imageName, event);

        this._docker.$subject.modem.followProgress(stream, onFinished, onProgress);
    });

    this.pullResult = this._docker.listImages({filter: this.imageName})
        .then(images => {
            if (images.length) {
                winston.debug("DockerContainer: image", this.imageName, "found locally; not pulling");
                return Promise.resolve();
            } else {
                winston.info("DockerContainer: pulling image", this.imageName);
                return this._docker.pull(this.imageName).then(onComplete, logAndThrow(["failed pulling image", this.imageName]));
            }
        });

}

DockerContainer.prototype.run = function ({ports, env, volumes, links}) {
    const create = () => {
        const options = {
            Image: this.imageName,
            name: this.containerName,
            Env: _.map(env, (v, k) => `${k}=${v}`),
            Volumes: _.mapValues(volumes, () => ({})),
            HostConfig: {
                Links: _.map(links, (v, k) => `${k}:${v}`),
                Binds: _.map(volumes, (v, k) => `${v}:${k}`),
            },
        }

        winston.info("DockerContainer.create: creating container with options", JSON.stringify(options));

        return this._docker.createContainer(options);
    }

    const start = (container) => {
        const bindings = {};

        if (ports) {
            bindings[ports.from + "/tcp"] = [{"HostPort": "" + ports.to}];
        }

        const options = {
            "PortBindings": bindings
        };

        winston.info("DockerContainer.start: starting container from image", this.imageName, "with options", JSON.stringify(options));
        winston.silly("DockerContainer: container = ", JSON.stringify(container));
        return container.start(options).then(() => {
            winston.debug("DockerContainer.start: container", this.containerName, "started");
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

DockerContainer.prototype.printLogs = function() {
    if (this._container) {
        winston.info("DockerContainer.logs: dumping logs for container", this.containerName);
        var color = ['red', 'green', 'yellow', 'blue'][Math.floor(Math.random() * 4)];
        return this.logs().then(logs => {
            logs.split('\n').map(line => {
                winston.info("DockerContainer", colors[color](this.containerName), ":", line);
            });
        });
    } else {
        winston.error("Can't dump logs of non-started container", this.containerName, "from image", this.imageName);
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
        winston.error("Can't dump logs of non-started container", this.containerName, "from image", this.imageName);
    }
};

DockerContainer.prototype.kill = function () {
    if (this._container) {
        winston.info("killing container", this.containerName);

        return this._container.stop()
            .catch(e => winston.info("error stopping container", e))
            .then(() => this._container.remove());
    } else {
        winston.info("Not shutting down non-started container", this.containerName, "from image", this.imageName);
    }
};

export default DockerContainer;