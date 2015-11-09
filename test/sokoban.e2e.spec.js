import './test.boot';
import Sokoban from '../src/sokoban';
import {expect} from 'chai';
import request from 'request-promise';

const sokoban = new Sokoban(process.env.DOCKER_HOST_IP);

after(sokoban.killAll.bind(sokoban));

describe("Sokoban", function () {
    this.timeout(1000 * 60 * 5);

    it("starts a container listening to a random port", () => {
        sokoban.provision("httpd", "httpd");

        const barrier = (host, portMappings) => request.get(`http://${host}:${portMappings["80"]}`);

        return sokoban.run({barrier, containerName: "httpd", publishAllPorts: true})
            .then(({host, portMappings}) => request.get(`http://${host}:${portMappings["80"]}`))
            .then(body => expect(body).to.include("It works!"));
    });
});
