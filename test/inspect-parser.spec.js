import './test.boot';
import {expect} from 'chai';
import {parsePorts} from '../src/inspect-parser';

describe("_parseMappings", () => {
    it("handles empty mappings", () => {
        expect(parsePorts({})).to.be.empty;
    });

    it("parses multiple port mappings ", () => {
        const mappings = {
                            "80/tcp": [
                                {
                                    "HostPort": 8080
                                }
                            ],
                            "443/tcp": [
                                {
                                    "HostPort": 8443
                                }
                            ]
                        };
        expect(parsePorts(mappings)).to.include({"80": 8080, "443": 8443});
    });

    it("skips port mappings for unpublished ports", () => {
        expect(parsePorts({"80/tcp": null})).to.be.empty;
    })
})

