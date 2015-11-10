import './test.boot';
import Sokoban from '../src/sokoban';
import {expect} from 'chai';
import request from 'request-promise';
import co from 'co';

const sokoban = new Sokoban(process.env.DOCKER_HOST_IP);

after(sokoban.killAll.bind(sokoban));

describe("Sokoban", function () {
    this.timeout(1000 * 60 * 5);

    it("starts a container listening to a random port",  () => co(function*() {
        sokoban.provision("httpd", "httpd");

        const barrier = (host, portMappings) => request.get(`http://${host}:${portMappings["80"]}`);

        const {host, portMappings} = yield sokoban.run({barrier, containerName: "httpd", publishAllPorts: true});
        const body = yield request.get(`http://${host}:${portMappings["80"]}`);

        expect(body).to.include("It works!");
    }));
});
