import fs from 'fs'
import path from 'path'
import request from 'request'
import pickBy from 'lodash/pickBy'
import keys from 'lodash/keys'
import find from 'lodash/find'
import writeMapping from './busStopsToLatLon.js'

var elastic = require('./elasticsearch')
elastic.ping();

elastic.indexExists().then(function (exists) {
  if (exists) {
    return elastic.deleteIndex();
  }
}).then(function () {
  return elastic.initIndex().then(elastic.initMapping)
});


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
if (!fs.existsSync('./busrouter-data/busStopLatLon.json')){
    writeMapping()
}

const secretPath = path.resolve('./secret');
const baseUrl = 'http://datamall2.mytransport.sg/ltaodataservice/BusArrival';
// let url = `${baseUrl}?BusStopID=${busStopId}`
const headers = Object.assign({}, {'accept':'application/json', 'cache-control': 'no-cache',},
    readJson(secretPath));
const mapping =  readJson('./busrouter-data/busStopLatLon.json')

function getDistanceFromLatLonInKm({lat: lat1,lon: lon1}, {lat: lat2,lon: lon2}) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1);
  var a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ;
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

function writeFormattedData(busStopCode, service, bus) {
    if (bus.Longitude === '0' || bus.Longitude === '' || bus.Latitude === '0' || bus.Latitude === '') {
        return;
    }

    const {ServiceNo, Status, Operator} = service;
    const distance = getDistanceFromLatLonInKm(
        {lat: bus.Latitude, lon: bus.Longitude},
        mapping[busStopCode]
        )
    const formatted = Object.assign({}, {
        ServiceNo,
        Status,
        Operator,
        date: new Date(),
        busStopCode,
        distance
    }, bus, {EstimatedArrival: new Date(bus.EstimatedArrival)})

    fs.appendFile(`./data/data.json`,JSON.stringify(formatted)+',\n');
    //elastic.addDocument(formatted).then(function(result){console.log(result)});
    // elastic.indexExists().then(elastic.addDocument(formatted));
}

function requestBusStopInfo(busStopCode, wantedServices) {
    const options = { method: 'GET',
      url: baseUrl,
      qs: { BusStopID: busStopCode },
      headers
    };
    request(options, (err, res, body)=>{
        if (!err && res.statusCode == 200) {
            const services = JSON.parse(body).Services;
            services.forEach((service)=>{
                // Just dont pass wantedServices if we want ALL the services
                if (wantedServices && !wantedServices.some((serviceNum)=> serviceNum === service.ServiceNo)){
                    return
                }

                writeFormattedData(busStopCode, service, service.NextBus);
                writeFormattedData(busStopCode, service, service.SubsequentBus);
                writeFormattedData(busStopCode, service, service.SubsequentBus3);
            })
        }
    })
}

function requestBusServiceInfo({1: mainRoute, 2: returnRoute}, wantedServices){
    mainRoute.stops.forEach((stop)=>{
        requestBusStopInfo(stop, wantedServices)
    })

    if (returnRoute){
        returnRoute.stops.forEach((stop)=>{
            requestBusStopInfo(stop, wantedServices)
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

const wantedServices = ['2']
const services = getBusServices(wantedServices) // 124 stops
// console.log(stops)
services.forEach((service)=>{
    requestBusServiceInfo(service, wantedServices)
})
