import sinon from 'sinon';
import SinonChai from 'sinon-chai';
import ChaiAsPromised from 'chai-as-promised';
import DockerContainer from '../src/docker-container';
import Sokoban from '../src/sokoban';
import chai from 'chai';
import Promise from 'promise';

const expect = chai.expect;
chai.use(SinonChai);
chai.use(ChaiAsPromised);


describe("Sokoban", function() {

    this.slow(2000);
    this.timeout(10000);

    const Host = "127.0.0.1";
    const sandbox = sinon.sandbox.create();

    let container;
    let sokoban;

    beforeEach(() => {
        container = sandbox.stub(DockerContainer.prototype);
        container.run.returns(Promise.resolve());

        sokoban = new Sokoban(Host);
    });

    afterEach(() => {
        sandbox.restore();
    });

    it("pulls a provisioned container", () => {
        sokoban.provision("a/b", "a");

        expect(container.pullIfNeeded).to.have.been.called;
    });

    describe("run", () => {

        beforeEach(() => sokoban.provision("a/b", "a"));

        it("runs a container", () => {
               const barrier = sandbox.spy();

               return sokoban.run({barrier, containerName: "a"})
                   .then(containerInfo => {
                       expect(barrier).to.have.been.called;
                       expect(containerInfo.host).to.equal(Host);
                   })
           });

           it("retries on barrier failure", () => {
               const barrier = sandbox.stub();

               barrier.onFirstCall().throws(new Error("kaboom"))
                   .onSecondCall().returns(true);

               return sokoban.run({barrier, containerName: "a", delayInterval: 1})
                   .then(() => expect(barrier).to.have.been.calledTwice);

           }) ;

           it("gives up when exceeded max retries", () => {
               const barrier = sandbox.stub();

               barrier.throws(new Error("kaboom"));

               return expect(sokoban.run({barrier, containerName: "a", delayInterval: 1, maxRetries: 1})).to.be.rejected;
           });
    });

    it("fetches logs from all containers", () => {
        sokoban.provision("a/b", "a");
        sokoban.provision("a/b", "b");

        container.printLogs.returns(Promise.resolve());

        return sokoban.dumpAllLogs().then(() => expect(container.printLogs).to.be.calledTwice);
    });

    it("kills all containers", () => {
        sokoban.provision("a/b", "a");
        sokoban.provision("a/b", "b");

        container.kill = sandbox.stub();
        container.kill.returns(Promise.resolve());

        return sokoban.killAll().then(() => expect(container.kill).to.be.calledTwice);
    });

    it("provides the host's address", () => {
        expect(sokoban.dockerHostName()).to.equal(Host);
    })
});