import './test.boot';
import sinon from 'sinon';
import DockerContainer from '../src/docker-container';
import Docker from 'dockerode-promise';
import Sokoban from '../src/sokoban';
import {expect} from 'chai';
import Promise from 'bluebird';
import {Duplex} from 'stream';

describe("Sokoban", function () {

    this.slow(2000);
    this.timeout(10000);

    const Host = "127.0.0.1";
    const sandbox = sinon.sandbox.create();

    let container;
    let sokoban;

    beforeEach(() => {
        container = sandbox.stub(DockerContainer.prototype);
        container.run.returns(Promise.resolve());
        container.getState.returns(Promise.resolve({Running: true}));

        sokoban = new Sokoban({hostname: Host});
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("pullImage", function() {

        let docker;
        const pullStream = new Duplex({readableObjectMode: true});
        pullStream.push(null);

        beforeEach(() => {
            docker = sandbox.stub(Docker.prototype);

            docker.pull.returns(Promise.resolve(pullStream));
        });

        this.slow(2000);
        const imageName = "a/b";

        it("attempts to pull images that do not exist locally", () => {
            const images = Promise.resolve([]);
            docker.listImages.withArgs({filter: imageName}).returns(images);

            return sokoban.pullImage(imageName)
                .then(() => expect(docker.pull).to.have.been.calledWith(imageName));
        });

        it("does not attempt to pull images that do exist locally", () => {
            const images = Promise.resolve([{}]);
            docker.listImages.withArgs({filter: imageName}).returns(images);

            return sokoban.pullImage(imageName)
                .then(() => expect(docker.pull).not.to.have.been.called);
        });
    });

    describe("run", () => {

        //beforeEach(() => sokoban.provision("a/b", "a"));

        it("runs a container", () => {
            const barrier = sandbox.spy();

            return sokoban.run({barrier, imageName: "a/b", containerName: "a"})
                .then(containerInfo => {
                    expect(barrier).to.have.been.called;
                    expect(containerInfo.host).to.equal(Host);
                })
        });

        it("retries on barrier failure", () => {
            const barrier = sandbox.stub();

            barrier.onFirstCall().throws(new Error("kaboom"))
                .onSecondCall().returns(true);

            return sokoban.run({barrier, imageName: "a/b", containerName: "a", delayInterval: 1})
                .then(() => expect(barrier).to.have.been.calledTwice);

        });

        it("gives up when exceeded max retries", () => {
            const barrier = sandbox.stub();

            barrier.throws(new Error("kaboom"));

            return expect(sokoban.run({barrier, imageName: "a/b", containerName: "a", delayInterval: 1, maxRetries: 1})).to.be.rejected;
        });

        it("does not fail when a container has finished running with a 0 exit code", () => {
            container.getState.returns(Promise.resolve({Running: false, ExitCode: 0}));

            return expect(sokoban.run({imageName: "a/b", containerName: "a"})).to.be.fulfilled;
        });
    });

    it("fetches logs from all containers", () => {
        sokoban.run({imageName: "a/b", containerName: "a"});
        sokoban.run({imageName: "a/b", containerName: "b"});

        container.printLogs.returns(Promise.resolve());

        return sokoban.dumpAllLogs().then(() => expect(container.printLogs).to.be.calledTwice);
    });

    it("kills all containers", () => {
        sokoban.run({imageName: "a/b", containerName: "a"});
        sokoban.run({imageName: "a/b", containerName: "b"});

        container.kill = sandbox.stub();
        container.kill.returns(Promise.resolve());

        return sokoban.killAll().then(() => expect(container.kill).to.be.calledTwice);
    });

    it("provides the host's address", () => {
        expect(sokoban.dockerHostName()).to.equal(Host);
    })
});