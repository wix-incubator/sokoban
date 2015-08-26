import DockerContainer from '../src/docker-container';
import retry from 'qretry';
import {expect} from 'chai';

describe("the docker driver", function() {

    var container;

    this.slow(3000);
    this.timeout(1000 * 15);

    it("creates and starts a container", () => {
        container = new DockerContainer("hello-world");
        container.pullIfNeeded();

        return container.run(null, {"SOMEVAR": "someValue"})
            .then(() => retry(() => container.logs().then(log => expect(log).to.contain('Hello from Docker.'))));
    });

    after("kill the container", () => container.kill);
});