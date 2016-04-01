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
In ./secret:
{
"AccountKey":"<your-key-here>",
"UniqueUserId":"<your-GUID-here>"
}
***/
const secretPath = path.resolve('./secret');
const busStops = readJson('./busrouter-data/bus-stops.json');
const baseUrl = 'http://datamall2.mytransport.sg/ltaodataservice/BusArrival';
// let url = `${baseUrl}?BusStopID=${busStopId}`
const headers = Object.assign({}, {'accept':'application/json', 'cache-control': 'no-cache',},
    readJson(secretPath));

function getFormattedData(service, bus){
    const {ServiceNo, Status, Operator} = service;

    return Object.assign({}, {ServiceNo, Status, Operator, date: new Date(), cDate: Date()}, bus)
}

function writeFormattedData(busStopCode, service, bus) {
    const formatted=  getFormattedData(service, bus)
    // console.log(formatted)
    fs.appendFile(`./data/${busStopCode}.json`,JSON.stringify(formatted)+',\n');
}

function requestBusStopInfo(busStopCode){
    const options = { method: 'GET',
      url: baseUrl,
      qs: { BusStopID: busStopCode },
      headers 
    };
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
    const servicesAtStops = readJson('./busrouter-data/bus-stops-services.json')
    return keys(pickBy(servicesAtStops, (services)=>{
        return services.some((service)=>{
            // return requestedServices.includes(service)
            return requestedServices.some((requested)=> requested === service)
        })
    }))
}

const stops = getStopsFromServices(['2']) // 124 stops

stops.forEach((code)=>{
    requestBusStopInfo(code)
})