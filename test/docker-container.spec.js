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

describe("DockerContainer", () => {
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

    describe("pullIfNeeded", function() {
        this.slow(2000);

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

    describe("run", () => {
        var fakeContainer = {};
        var containerName = "a";
        var run = options => new DockerContainer(imageTag, containerName).run(options || {});

        beforeEach("initialize a fake controller", () => {
            fakeContainer.start = sandbox.stub();
            fakeContainer.start.returns(Promise.resolve());
            docker.createContainer.returns(Promise.resolve(fakeContainer));
        });

        it("creates and starts a container", () => run()
            .then(() => expect(docker.createContainer).to.be.calledWithMatch({name: containerName, Image: imageTag}))
            .then(() => expect(fakeContainer.start).to.be.called));

        it("passes port bindings to the container's start method", () => run({ports: {from: 1000, to: 2000}})
            .then(() => expect(fakeContainer.start).to.be.calledWith({"PortBindings": {"1000/tcp": [{HostPort: "2000"}]}})));

        it("passes environment variables to the container", () => run({env: {a: 'b', c: 'd'}})
            .then(() => expect(docker.createContainer).to.be.calledWithMatch({Env: ["a=b", "c=d"]})));

        it("passes links to the container", () => run({links: {"containerName": "nameInTarget"}})
            .then(() => expect(docker.createContainer).to.be.calledWithMatch({HostConfig: {Links: ["containerName:nameInTarget"]}})));

    });

});


