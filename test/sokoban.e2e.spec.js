import './test.boot';
import Sokoban from '../src/sokoban';
import {expect} from 'chai';
import request from 'request-promise';
import co from 'co';

const sokoban = new Sokoban({hostname: process.env.DOCKER_HOST_IP});

after(sokoban.killAll.bind(sokoban));

describe("Sokoban", function () {
    this.timeout(1000 * 60 * 5);

    it("starts a container with the given name and returns that name", () => co(function*() {
        sokoban.provision("hello-world", "hello");

        const {containerName} = yield(sokoban.run({containerName: "hello"}));
        expect(containerName).to.equal("hello");
    }));

    it("starts a container with a randomized name and returns that name", () => co(function*() {
        sokoban.options.randomizeNames = true;
        sokoban.provision("hello-world", "hello2");

        const {containerName} = yield(sokoban.run({containerName: "hello2"}));
        expect(containerName).to.startWith("hello2").and.not.equal("hello2");
    }).catch(onerror));

    it("starts a container listening to a random port",  () => co(function*() {
        sokoban.provision("httpd", "httpd");

        const barrier = (host, portMappings) => request.get(`http://${host}:${portMappings["80"]}`);

        const {host, portMappings} = yield sokoban.run({barrier, containerName: "httpd", publishAllPorts: true});
        const body = yield request.get(`http://${host}:${portMappings["80"]}`);

        expect(body).to.include("It works!");
    }).catch(onerror));

    it("fails with a descriptive error when the containers did not start", () => {
        sokoban.provision("electricmonk/exiter", "exiter");

        return expect(sokoban.run({containerName: "exiter", env: {CODE: 42}})).to.be.rejectedWith("Container exiter exited with code 42");
    });
});


function onerror(err) {
    throw err;
}