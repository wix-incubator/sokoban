import './test.boot';
import sinon from 'sinon';
import DockerContainer from '../src/docker-container';
import Docker from 'dockerode-promise';
import chai, {expect} from 'chai';
import Promise from 'bluebird';

describe("DockerContainer", () => {
    const imageName = "a/b";
    const sandbox = sinon.sandbox.create();

    let docker;

    beforeEach(() => {
        docker = sandbox.stub(Docker.prototype);
        docker.pull.returns(Promise.resolve());
    });

    afterEach(() => {
        sandbox.restore();
    });

    const fakeContainer = {};
    const containerName = "a";
    const run = options => {
        const container = new DockerContainer({docker: new Docker(), imageName, containerName});
        return container.run(options || {})
            .then(() => container) };

    beforeEach("initialize a fake controller", () => {
        docker.createContainer.returns(Promise.resolve(fakeContainer));
        fakeContainer.start = sandbox.stub();
        fakeContainer.start.returns(Promise.resolve());
    });

    describe("run", () => {
        it("creates and starts a container", () => run()
            .then(container => expect(container.isRunning()).to.be.true)
            .then(() => expect(docker.createContainer).to.be.calledWithMatch({name: containerName, Image: imageName}))
            .then(() => expect(fakeContainer.start).to.be.called));


        it("passes port bindings to the container's start method", () => run({ports: {from: 1000, to: 2000}})
            .then(() => expect(fakeContainer.start).to.be.calledWith({"PortBindings": {"1000/tcp": [{HostPort: "2000"}]}})));

        it("passes environment variables to the container", () => run({env: {a: 'b', c: 'd'}})
            .then(() => expect(docker.createContainer).to.be.calledWithMatch({Env: ["a=b", "c=d"]})));

        it("passes links to the container", () => run({links: {"containerName": "nameInTarget"}})
            .then(() => expect(docker.createContainer).to.be.calledWithMatch({HostConfig: {Links: ["containerName:nameInTarget"]}})));

        it("passes volumes and binds to the container", () => run({volumes: {"/guestDir": "/hostDir"}})
            .then(() => expect(docker.createContainer).to.be.calledWithMatch({Volumes: {"/guestDir": {}}, HostConfig: {Binds: ["/hostDir:/guestDir"]}})));

        it("passes PublishAllPorts to createContainer", () => run({publishAllPorts: true})
            .then(() => expect(docker.createContainer).to.be.calledWithMatch({HostConfig: {PublishAllPorts: true}})));
    });

    it("returns a mapping of container to host ports", () => {
        fakeContainer.inspect = sandbox.stub();
        fakeContainer.inspect.returns(Promise.resolve({
            "NetworkSettings": {
                "Ports": {
                    "80/tcp": [
                        {
                            "HostPort": 8080
                        }
                    ]
                }
            }
        }));

        return run()
            .then(container => container.getPortMappings())
            .then(mappings => expect(mappings).to.eql({80: 8080}));
    });
});
