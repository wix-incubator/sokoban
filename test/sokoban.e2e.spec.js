import './test.boot';
import Sokoban from '../src/sokoban';
import {expect} from 'chai';
import request from 'request-promise';

var sokoban = new Sokoban();

after(sokoban.killAll.bind(sokoban));

describe("Sokoban", function () {
    this.timeout(1000 * 30);

    it("starts a container listening to a random port", () => {
        sokoban.provision("httpd", "httpd");

        return sokoban.run({containerName: "httpd", publishAllPorts: true})
            .then(({host, portMappings}) => request.get(`http://${host}:${portMappings["80"]}`))
            .then(body => expect(body).to.include("It works!"));
    });
});
