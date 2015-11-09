import _ from 'lodash';

export function parsePorts(mappings) {
    return _(mappings)
        .pairs()
        .filter(([_, hostMappings]) => !!hostMappings)
        .map(([containerMapping, hostMappings]) => {
            const containerPort = containerMapping.substr(0, containerMapping.indexOf("/"));
            return [containerPort, hostMappings[0].HostPort];
        })
        .zipObject()
        .value();
}