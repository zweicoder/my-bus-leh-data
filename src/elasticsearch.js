var elasticsearch = require('elasticsearch');
var elasticClient = new elasticsearch.Client({
    host: 'localhost:9200',
    log: 'info'
});

var indexName = "busdata";
var typeName ="bus";

function ping(){
  return elasticClient.ping({
    // ping usually has a 3000ms timeout
    requestTimeout: Infinity,
    // undocumented params are appended to the query string
    hello: "elasticsearch!"
  }, function (error) {
    if (error) {
      console.trace('elasticsearch cluster is down!');
    } else {
      console.log('elasticsearch is well!');
    }
  })
}
exports.ping = ping;

/**
* Delete an existing index
*/
function deleteIndex() {
    return elasticClient.indices.delete({
        index: indexName
    });
}
exports.deleteIndex = deleteIndex;

/**
* create the index
*/
function initIndex() {
    return elasticClient.indices.create({
        index: indexName
    }).then(elasticClient.indices.putSettings({
      index: indexName,
    }));
}
exports.initIndex = initIndex;

/**
* check if the index exists
*/
function indexExists() {
    return elasticClient.indices.exists({
        index: indexName
    });
}
exports.indexExists = indexExists;

function initMapping() {
    return elasticClient.indices.putMapping({
        index: indexName,
        type: typeName,
        body: {
            properties: {
                ServiceNo: { type: "string" },
                Status: { type: "string" },
                Operator: { type: "string" },
                date: { type: "date" },
                busStopCode: { type: "string" },
                distance: {type: "integer"},
                EstimatedArrival: {type: "date"},
                Latitude: {type: "string"},
                Longitude: {type: "string"},
                VisitNumber: {type:"string"},
                Load:{type:"string"},
                Feature: {type: "string"}

            }
        }
    });
}
exports.initMapping = initMapping;

function addDocument(document) {
    return elasticClient.index({
        index: indexName,
        type: typeName,
        body: {
          ServiceNo: document.ServiceNo,
          Status: document.Status,
          Operator: document.Operator,
          date: document.date,
          busStopCode: document.busStopCode,
          distance: document.distance,
          EstimatedArrival: document.EstimatedArrival,
          Latitude: document.Latitude,
          Longitude: document.Longitude,
          VisitNumber: document.VisitNumber,
          Load:document.Load,
          Feature: document.Feature

        }
    });
}
exports.addDocument = addDocument;

function queryBus(context) {
  var defaults = {
    dateStart: 0,
    dateEnd: (new Date).getTime()
  }
  var context = extend(defaults,context);
  const Start = (new Date(context.dateStart)).getTime();  //Convert to epoch millis
  const End = (new Date(context.dateEnd)).getTime();
  var query = {
    constant_score: {
      filter:[
        {range:{
          date: {
            gte:Start,
            lte:End,
          }}},
        ]
      }
    };
    if(context.hasOwnProperty("busStopCode")){
      query.constant_score.filter.unshift(getTerm("busStopCode",context.busStopCode))
    }
    if(context.hasOwnProperty("busNo")){
      query.constant_score.filter.unshift(getTerm("ServiceNo",context.busNo))
    }
    return elasticClient.search({
      index: indexName,
      type: typeName,
      body: {
        query: query
      }
    });
  }
exports.queryBus = queryBus;

function getTerm(key,value){
  var obj={};
  obj[key]=value;
  return {term: obj
  }
}

function extend() {
    for (var i = 1; i < arguments.length; i++)
        for (var key in arguments[i])
            if (arguments[i].hasOwnProperty(key))
                arguments[0][key] = arguments[i][key];
    return arguments[0];
}
