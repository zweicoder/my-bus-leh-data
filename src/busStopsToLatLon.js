import fs from 'fs'
import path from 'path'

function readJson(path) {
    return JSON.parse(fs.readFileSync(path,'utf-8'))
}

function writeMapping(){
    const busStops = readJson('./busrouter-data/bus-stops.json');
    const map = busStops.reduce((memo, busStop) => {
        const { lat, lng } = busStop
        const coords = { lat, lon: lng }
        return Object.assign(memo, {[busStop.no]: coords})
    }, {})

    fs.writeFile(`./busrouter-data/busStopLatLon.json`,JSON.stringify(map));
}


export default writeMapping