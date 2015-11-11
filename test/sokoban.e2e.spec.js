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

        const {containerName} = yield(sokoban.run({imageName: "hello-world", containerName: "hello"}));
        expect(containerName).to.equal("hello");
    }));

    it("starts a container with a randomized name and returns that name", () => co(function*() {
        sokoban.options.randomizeNames = true;

        const {containerName} = yield(sokoban.run({imageName: "hello-world", containerName: "hello2"}));
        expect(containerName).to.startWith("hello2").and.not.equal("hello2");
    }).catch(onerror));

    it("starts a container listening to a random port",  () => co(function*() {
        const pollServer = (host, portMappings) => request.get(`http://${host}:${portMappings["80"]}`);

        const body = yield sokoban.run({imageName: "httpd", containerName: "httpd", publishAllPorts: true, barrier: pollServer})
            .then(({host, portMappings}) => pollServer(host, portMappings));

        expect(body).to.include("It works!");
    }).catch(onerror));

    it("fails with a descriptive error when the containers did not start", () => {
        return expect(sokoban.run({imageName: "electricmonk/exiter", containerName: "exiter", env: {CODE: 42}})).to.be.rejectedWith("Container exiter exited with code 42");
    });
});


function onerror(err) {
    throw err;
}