import sinon from 'sinon';
import SinonChai from 'sinon-chai';
import ChaiString from 'chai-string';
import DockerContainer from '../src/docker-container';
import Docker from 'dockerode-promise';
import chai from 'chai';
import winston from 'winston';
import Promise from 'promise';
import retry from 'qretry';

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

    it("passes environment variables to the container", () => {
        var fakeContainer = {};
        fakeContainer.start = sandbox.stub();
        fakeContainer.start.returns(Promise.resolve());
        docker.createContainer.returns(Promise.resolve(fakeContainer));

        return new DockerContainer(imageTag, "a")
            .run(null, {a: 'b', c: 'd'})
            .then(() => {
               return expect(docker.createContainer).to.be.calledWith({name: "a", Image: imageTag, Env: ["a=b", "c=d"]});
            });
    });
});

// this is the integration test
describe("the docker driver", function() {

    var container;

    this.slow(3000);
    this.timeout(1000 * 15);

    it("creates and starts a container", () => {
        winston.level = 'silly';

        container = new DockerContainer("hello-world");
        container.pullIfNeeded();

        return container.run(null, {"SOMEVAR": "someValue"})
            .then(() => retry(() => container.logs().then(log => expect(log).to.contain('Hello from Docker.'))));
    });

    after("kill the container", () => container.kill);
});