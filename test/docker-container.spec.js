import sinon from 'sinon';
import SinonChai from 'sinon-chai';
import ChaiString from 'chai-string';
import DockerContainer from '../src/docker-container';
import Docker from 'dockerode-promise';
import chai from 'chai';
import winston from 'winston';
import Promise from 'promise';

var expect = chai.expect;
chai.use(SinonChai);
chai.use(ChaiString);

describe("creating a new container", function() {
    this.slow(2000);

    var imageTag = "a/b";
    var docker;

    var sandbox;

    beforeEach(() => {
        sandbox = sinon.sandbox.create();
        docker = sandbox.stub(Docker.prototype);
    });

    afterEach(() => {
        sandbox.restore();
    });

    it("attempts to pull images that do not exist locally", () => {
        var images = Promise.resolve([]);
        docker.listImages.withArgs({filter: imageTag}).returns(images);

        new DockerContainer(imageTag, "a").pullIfNeeded();

        return images.then(() => expect(docker.pull).to.have.been.calledWith(imageTag));
    });

    it("does not attempt to pull images that do exist locally", () => {
        var images = Promise.resolve([{}]);
        docker.listImages.withArgs({filter: imageTag}).returns(images);

        new DockerContainer(imageTag, "a").pullIfNeeded();

        return images.then(() => expect(docker.pull).not.to.have.been.called);
    });
});

// this is the integration test
describe("the docker driver", function() {

    var container;

    this.slow(3000);
    this.timeout(1000 * 15);

    function consumeFirstLine(stream) {
        var resolved = false;
        return new Promise(function(resolve, reject) {
            stream.on('line', line => {
                if (!resolved) {
                    resolved = true;
                    resolve(line);
                }}).on('error', reject)
                   .on('close', () => { if (!resolved) reject(new Error("Stream was empty")) });
        });
    }

    it("creates and starts a container", () => {
        container = new DockerContainer("hello-world");
        container.pullIfNeeded();

        return container.run()
            .then(() => container.logs())
            .then(consumeFirstLine)
            .then(line => expect(line).to.endWith('Hello from Docker.'));
    });

    after("kill the container", () => container.kill);
});