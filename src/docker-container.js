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
    this.docker = ~['darwin', 'win32'].indexOf(process.platform) ? new Docker() : new Docker({socketPath: '/var/run/docker.sock'});

    this.imageName = imageName;
    this.containerName = containerName;

    this.theContainer = undefined;
    this.pullResult = Promise.resolve();
}

DockerContainer.prototype.pullIfNeeded = function () {

    var docker = this.docker;
    var imageName = this.imageName;

    function onComplete(stream) {
        return new Promise(function (resolve, reject) {
            function onFinished(err, output) {
                if (err) {
                    winston.error("DockerContainer: pull failed with error", err);
                    reject(err);
                } else {
                    winston.info("DockerContainer: pull complete for image", imageName);
                    resolve(output);
                }
            }

            function onProgress(event) {
                winston.silly("DockerContainer: pull.onProgress", imageName, event);
            }

            docker.$subject.modem.followProgress(stream, onFinished, onProgress);
        });
    }

    this.pullResult = docker.listImages({filter: imageName})
        .then(images => {
            if (images.length) {
                winston.debug("DockerContainer: image", imageName, "found locally; not pulling");
                return Promise.resolve();
            } else {
                winston.info("DockerContainer: pulling image", imageName);
                return docker.pull(imageName).then(onComplete, logAndThrow(["failed pulling image", imageName]));
            }
        });

}

DockerContainer.prototype.run = function ({ports, env, volumes, links}) {
    var create = () => {
        var options = {
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

        return this.docker.createContainer(options);
    }

    var start = (container) => {
        var bindings = {};

        if (ports) {
            bindings[ports.from + "/tcp"] = [{"HostPort": "" + ports.to}];
        }

        var options = {
            "PortBindings": bindings
        };

        winston.info("DockerContainer.start: starting container from image", this.imageName, "with id", container.id, "and options", JSON.stringify(options));
        return container.start(options).then(() => {
            winston.debug("DockerContainer.start: container", this.containerName, "started");
            this.theContainer = container;
        });
    }

    return this.pullResult
        .then(create, logAndThrow(["failed creating container for image", this.imageName]))
        .then(start, logAndThrow(["failed starting container for image", this.imageName]));
};

DockerContainer.prototype.isRunning = function() {
    return !!this.theContainer;
}

DockerContainer.prototype.printLogs = function () {
    if (this.theContainer) {
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
    var docker = this.docker;
    if (this.theContainer) {
        return this.theContainer.logs({stdout: 1, stderr: 0})
            .then(muxedStream => new Promise(function (resolve, reject) {
                var buffer = "";
                var ts = through(function (data) {
                    this.queue(data)
                }, function () {
                    this.queue(null)
                }).on('data', data => buffer += data);

                muxedStream.on('error', reject)
                    .on('end', () => resolve(buffer));

                docker.$subject.modem.demuxStream(muxedStream, ts, ts);

            }));
    } else {
        winston.error("Can't dump logs of non-started container", this.containerName, "from image", this.imageName);
    }
};

DockerContainer.prototype.kill = function () {
    if (this.theContainer) {
        winston.info("killing container", this.containerName);

        return this.theContainer.stop()
            .then(() => this.theContainer.remove());
    } else {
        winston.error("Not shutting down non-started container", this.containerName, "from image", this.imageName);
    }
};

DockerContainer.prototype.host = function () {
    if (process.env.DOCKER_HOST) {
        return url.parse(process.env.DOCKER_HOST).hostname;
    } else {
        throw new Error("DOCKER_HOST environment variable is required");
    }
}

export default DockerContainer;