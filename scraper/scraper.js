import fs from 'fs'
import path from 'path'
import request from 'request'
import pickBy from 'lodash/pickBy'
import keys from 'lodash/keys'

// Make data folder
function mkdirIfNotExists(dir){
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
}

function readJson(path) {
    return JSON.parse(fs.readFileSync(path,'utf-8'))
}

mkdirIfNotExists('./data')

/***
In ./scraper/secret:
{
"AccountKey":"<your-key-here>",
"UniqueUserId":"<your-GUID-here>"
}
***/
const secretPath = path.resolve('./scraper/secret');
const busStops = readJson('./scraper/bus-stops.json');
const baseUrl = 'http://datamall2.mytransport.sg/ltaodataservice/BusArrival';
const busStopId = '83139' // TODO get array from bus stops.json
// let url = `${baseUrl}?BusStopID=${busStopId}`
const headers = Object.assign({}, {'accept':'application/json', 'cache-control': 'no-cache',},
    readJson(secretPath));
const options = { method: 'GET',
  url: baseUrl,
  qs: { BusStopID: busStopId },
  headers };

function getFormattedData(service, bus){
    const {ServiceNo, Status, Operator} = service;

    return Object.assign({}, {ServiceNo, Status, Operator}, bus)
}

function writeFormattedData(busStopCode, service, bus) {
    const formatted=  getFormattedData(service, bus)
    // console.log(formatted)
    fs.appendFile(`./data/${busStopCode}.json`,JSON.stringify(formatted)+',\n');
}

function requestBusStopInfo(busStopCode){
    request(options, (err, res, body)=>{
        if (!err && res.statusCode == 200) {
            const services = JSON.parse(body).Services;
            services.forEach((service)=>{
                writeFormattedData(busStopCode, service, service.NextBus);
                writeFormattedData(busStopCode, service, service.SubsequentBus);
                writeFormattedData(busStopCode, service, service.SubsequentBus3);
            })
        }
    })
}

function getStopsFromServices(requestedServices) {
    console.log('Getting stops for services: ',requestedServices)
    const servicesAtStops = readJson('./scraper/bus-stops-services.json')
    return keys(pickBy(servicesAtStops, (services)=>{
        return services.some((service)=>{
            // return requestedServices.includes(service)
            return requestedServices.some((requested)=> requested === service)
        })
    }))
}

// const stops = getStopsFromServices(['5']) // 119 stops
// console.log(stops)

requestBusStopInfo(busStopId)
