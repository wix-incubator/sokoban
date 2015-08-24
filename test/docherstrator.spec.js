import sinon from 'sinon';
import SinonChai from 'sinon-chai';
import ChaiAsPromised from 'chai-as-promised';
import DockerContainer from '../src/docker-container';
import Docherstrator from '../src/docherstrator';
import chai from 'chai';
import winston from 'winston';
import Promise from 'promise';

var expect = chai.expect;
chai.use(SinonChai);
chai.use(ChaiAsPromised);


describe("Docherstrator", () => {
    const Host = "127.0.0.1";

    var container;
    var sandbox;
    var docherstrator;

    beforeEach(() => {
        sandbox = sinon.sandbox.create();
        container = sandbox.stub(DockerContainer.prototype);
        container.host.returns(Host);
        container.run.returns(Promise.resolve());

        docherstrator = new Docherstrator();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it("pulls a provisioned container", () => {
        docherstrator.provision("a/b", "a");

        expect(container.pullIfNeeded).to.have.been.called;
    });

    it("runs a container", () => {
        var barrier = sandbox.spy();
        docherstrator.provision("a/b", "a");

        return docherstrator.run({barrier, containerName: "a"})
            .then(containerInfo => {
                expect(barrier).to.have.been.called;
                expect(containerInfo.host).to.equal(Host);
            })
    });

    it("retries on barrier failure", () => {
        var barrier = sandbox.stub();
        docherstrator.provision("a/b", "a");

        barrier.onFirstCall().throws(new Error("kaboom"))
            .onSecondCall().returns(true);

        return docherstrator.run({barrier, containerName: "a"})
            .then(() => {
                expect(barrier).to.have.been.calledTwice;
            })

    }) ;

    it("gives up when exceeded max retries", () => {
        var barrier = sandbox.stub();
        docherstrator.provision("a/b", "a");

        barrier.throws(new Error("kaboom"));

        return expect(docherstrator.run({barrier, containerName: "a", maxRetries: 1})).to.be.rejected;
    });

    it("fetches logs from all containers", () => {
        docherstrator.provision("a/b", "a");
        docherstrator.provision("a/b", "b");

        container.printLogs.returns(Promise.resolve());

        return docherstrator.dumpAllLogs().then(() => {
            return expect(container.printLogs).to.be.calledTwice;
        })
    });

    it("kills all containers", () => {
        docherstrator.provision("a/b", "a");
        docherstrator.provision("a/b", "b");

        container.kill = sandbox.stub();
        container.kill.returns(Promise.resolve());

        return docherstrator.killAll().then(() => {
            return expect(container.kill).to.be.calledTwice;
        })
    });
});