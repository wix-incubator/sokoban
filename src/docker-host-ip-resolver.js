import Url from 'url';
import childProcess from 'child_process';

export default function DockerHostIpResolver(hostName) {
    this.hostName = hostName;
}

DockerHostIpResolver.prototype.resolve = function() {
    return this.hostName || getIpFromEnv() || getIpFromInsideContainer() || null;
}

function getIpFromEnv() {
    try {
        const host = process.env.DOCKER_HOST;
        const url = Url.parse(host);
        return url && url.hostname;
    } catch(e) {
        return null;
    }
}

function getIpFromInsideContainer() {
    return childProcess.execSync("/sbin/ip route|awk '/default/ { print $3 }'").toString().trim();
}