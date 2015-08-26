import DockerContainer from '../src/docker-container';
import retry from 'qretry';
import {expect} from 'chai';
import winston from 'winston';

describe("the docker driver", function() {

    let container;

    this.slow(3000);
    this.timeout(1000 * 15);

    it("creates and starts a container", () => {
        container = new DockerContainer("hello-world", "helloWorldContainer");
        container.pullIfNeeded();

        winston.level = 'info';

        return container.run({env: {"SOMEVAR": "someValue"}})
            .then(() => retry(() => container.logs().then(log => expect(log).to.contain('Hello from Docker.'))))
            .then(() => container.kill())
            .then(() => expect(() => container._docker.getContainer(container._container.id)).to.throw)
        ;
    });

});