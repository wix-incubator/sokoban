import DockerHostIpResolver from '../src/docker-host-ip-resolver';
import chai, {expect} from 'chai';
import sinon from 'sinon';
import SinonChai from 'sinon-chai';
import childProcess from 'child_process';

chai.use(SinonChai);

describe("the ip resolver", () => {
    let DOCKER_HOST_ENV;
    const sandbox = sinon.sandbox.create();

    afterEach(() => {
        sandbox.restore();
    });

    beforeEach("clean the environment", () => {
        DOCKER_HOST_ENV = process.env.DOCKER_HOST;
        delete process.env.DOCKER_HOST;
    })

    afterEach("trash the environment", () => {
        process.env.DOCKER_HOST = DOCKER_HOST_ENV;
    })

    it("uses the provided host if it's defined", () => {
        const host = "foobar";
        const resolver = new DockerHostIpResolver(host);

        expect(resolver.resolve()).to.equal(host);
    });

    it("uses the DOCKER_HOST environment variable", () => {
        const host = "foobar";
        process.env.DOCKER_HOST = `tcp://${host}:1234`;
        const resolver = new DockerHostIpResolver();

        expect(resolver.resolve()).to.equal(host);
    });

    it("attempts to resolve using /sbin/ip", () => {
        const host = "foobar";
        sandbox.stub(childProcess, 'execSync', (command) => {
            if (command === `/sbin/ip route|awk '/default/ { print $3 }'`) {
                return host;
            } else {
                return "";
            }
        });

        const resolver = new DockerHostIpResolver();

        expect(resolver.resolve()).to.equal(host);
    });

    it("fallbacks to null if could not resolve using any strategy", () => {
        sandbox.stub(childProcess, 'execSync').returns("");

        expect((new DockerHostIpResolver()).resolve()).to.be.null;
    });
});