import fs from 'fs'
import path from 'path'
import request from 'request'
import pickBy from 'lodash/pickBy'
import keys from 'lodash/keys'
import find from 'lodash/find'

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

function getFormattedData(service, bus, direction){
    const {ServiceNo, Status, Operator} = service;

    return Object.assign({}, {ServiceNo, Status, Operator, direction, date: new Date(), cDate: Date()}, bus)
}

function writeFormattedData(busStopCode, service, bus, direction) {
    if (bus.Longitude === '0' || bus.Longitude === '' || bus.Latitude === '0' || bus.Latitude === '') {
        return;
    }

    const {ServiceNo, Status, Operator} = service;
    const formatted = Object.assign({}, {ServiceNo, Status, Operator, direction, date: new Date(), cDate: Date()}, bus)
    // console.log(formatted)
    fs.appendFile(`./data/${busStopCode}.json`,JSON.stringify(formatted)+',\n');
}

function requestBusStopInfo(busStopCode, direction) {
    const options = { method: 'GET',
      url: baseUrl,
      qs: { BusStopID: busStopCode },
      headers 
    };
    request(options, (err, res, body)=>{
        if (!err && res.statusCode == 200) {
            const services = JSON.parse(body).Services;
            services.forEach((service)=>{
                writeFormattedData(busStopCode, service, service.NextBus, direction);
                writeFormattedData(busStopCode, service, service.SubsequentBus, direction);
                writeFormattedData(busStopCode, service, service.SubsequentBus3, direction);
            })
        }
    })
}

function requestBusServiceInfo({1: mainRoute, 2: returnRoute}){
    mainRoute.stops.forEach((stop)=>{
        requestBusStopInfo(stop, 1)
    })

    if (returnRoute){
        returnRoute.stops.forEach((stop)=>{
            requestBusStopInfo(stop, 2)
        })
    }
}

function getBusServices(requestedServices) {
    console.log('Getting info for services: ',requestedServices)
    const files = fs.readdirSync('./busrouter-data/bus-services')
    const wantedFiles = files.filter((file)=>{
        return requestedServices.some((requested)=>`${requested}.json` === file)
    })

    return wantedFiles.map((file)=> readJson(path.resolve('./busrouter-data/bus-services', file)))
}

const services = getBusServices(['2']) // 124 stops
// console.log(stops)
services.forEach((service)=>{
    requestBusServiceInfo(service)
})