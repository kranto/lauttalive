import uuid from 'uuid';
import Paho from 'paho-mqtt';
import $ from 'jquery';

let baseUri = "https://meri-aws-test.digitraffic.fi/api/v1/";
let STATUS = { STOPPED: 0, ONTHEMOVE: 1 };
let connectOk = false;
let messageCount = 0;

var otherVessels = [
230629000, // Viking Grace
230172000, // Amorella
230361000, // Gabriella
230181000, // Mariella
230180000, // Rosella
266027000, // Viking Cinderella

230639000, // Baltic Princess
266301000, // Galaxy
230184000, // Silja Serenade
265004000, // Silja Symphony
276779000, // Baltic Queen
276519000, // Victoria I

230671000, // Finnswan
230637000, // Finnfellow
266308000, // Eckerö
266314000, // Birka Stockholm
276817000, // Sailor

230942840, // Otava

];
let piers = [
  {name: "Krok", coords: [21.735581,60.127427]},
];

function distance(c1, c2) {
  return Math.max(Math.abs(c1[0]-c2[0])*55000, Math.abs(c1[1]-c2[1])*110000);
}

function isRecentLocation(location, now) {
  return now - location.properties.timestampExternal < 600000;
}

function isPassangerVessel(metadata) {
  return metadata && (metadata.shipType === 0 || metadata.shipType === 60);
}

function isInArea(feature) {
  var coords = feature.geometry.coordinates;
  return (coords[0] >= 19.8 && coords[0] <= 23 && coords[1] >= 59.7 && coords[1] <= 60.7);
}

console.log(window.Paho);
let client = new Paho.Client("", 61619, '');

function connect() {
  console.log('trying to connect...');

  client.onConnectionLost = function (response) {
    console.log(response);
    console.info('Connection lost:' + response.errorMessage);
  };
  
  client.onMessageArrived = function(message) {
    console.log('Message arrived', message);
  };

  client.connect({
    // hosts:["b-afca9ce3-f38d-459d-b495-43d879decdaa-1.mq.eu-west-1.amazonaws.com","b-afca9ce3-f38d-459d-b495-43d879decdaa-2.mq.eu-west-1.amazonaws.com"],
    hosts:["b-afca9ce3-f38d-459d-b495-43d879decdaa-2.mq.eu-west-1.amazonaws.com"],
    ports:[61619],
    onSuccess: onConnect1,
    mqttVersion:4,
    useSSL:true,
    userName:"marine", password:"digitraffic_marine"});
}

function onConnect1() {
  console.info('Connection open');
  otherVessels
    .forEach(mmsi => { client.subscribe("vessels/" + mmsi + "/#"); });
}

//connect();


// --

class VesselStatus {

  constructor(app) {
    console.log('VesselStatus initialized', app);
    this.app = app;
    console.log(this.app);
    this.lastUpdate = 0;
    this.vessels = {};
    this.latestLocations = {};
    this.latestPositions = {};
    this.init();
  }

  connect() {
    console.log('trying to connect...');
    this.app.updateStatus("connecting");
    connectOk = false;
    messageCount = 0;

    this.client = client; //  new Paho.Client("", 61619, '');

    client.onConnectionLost = function (response) {
      console.info('Connection lost:' + response.errorMessage);
      this.app.updateStatus("connection lost");
    }.bind(this);
    
    client.onMessageArrived = function(message) {
      let content = message.payloadString;
      this.handleMessage(content);
      this.app.addRawMessage(content);
      if (messageCount === 0) {
        this.app.updateStatus("First message arrived", "firstmessagearrived");
        messageCount++;
      } else {
        this.app.updateStatus("Messages arrived: " + (++messageCount), "messagearrived");                    
      }
    }.bind(this);

    client.connect({
      // hosts:["b-afca9ce3-f38d-459d-b495-43d879decdaa-1.mq.eu-west-1.amazonaws.com","b-afca9ce3-f38d-459d-b495-43d879decdaa-2.mq.eu-west-1.amazonaws.com"],
      hosts:["b-afca9ce3-f38d-459d-b495-43d879decdaa-2.mq.eu-west-1.amazonaws.com"],
      ports:[61619],
      onSuccess:this.onConnect.bind(this),
      mqttVersion:4,
      useSSL:true,
      userName:"marine", password:"digitraffic_marine"});
  }

  onConnect() {
    console.info('Connection open');
    this.app.updateStatus("connected");
    if (connectOk) return;
    connectOk = true;
    messageCount = 0;
    var client = this.client;
    var latestLocations = this.latestLocations;
    Object.keys(this.latestLocations)
      .forEach(mmsi => { client.subscribe("vessels/" + mmsi + "/#"); });
    otherVessels
      .filter(mmsi => { return this.latestLocations[mmsi]; })
      .forEach(mmsi => { client.subscribe("vessels/" + mmsi + "/#"); });
  }

  convert(message) {
    var content = message.payloadString;
    var topic = message.destinationName;
    var time = Date.now();
    var data = JSON.parse(content);
    var difference;

    if (typeof data.properties == "undefined") {
      difference = time - data.timestamp;
    } else {
      difference = time - data.properties.timestampExternal;
    }

    return time + ":(" + difference + "): " + topic + ": " + content;
  }

  storeMetadata(metadata) {
    this.vessels[metadata.mmsi] = metadata;
  }

  handleMetadata(metadata) {
    if (!isPassangerVessel(metadata)) return;
    this.storeMetadata(metadata);
  }

  storeLocation(feature) {
    var coords = feature.geometry.coordinates;
    coords[0] = Math.round(coords[0] * 100000) / 100000;
    coords[1] = Math.round(coords[1] * 100000) / 100000;
    this.latestLocations[feature.mmsi] = {coords: coords, properties: feature.properties};
    this.lastUpdate = Date.now();
    this.updatePosition(feature);
  }

  handleLocation(feature) {
    delete this.latestLocations[feature.mmsi];
    if ((isInArea(feature) || otherVessels.indexOf(feature.mmsi) >= 0) && this.vessels[feature.mmsi]) {
      this.storeLocation(feature);
      return true;
    } else {
      return false;
    }
  }

  handleMessage(content) {
    var data = JSON.parse(content);

    if (data && data.shipType) { // is metadata
      this.handleMetadata(data);
    }

    if (data && data.geometry) { // is location geojson
      this.handleLocation(data);
    }
  }

  loadLocations(callback) {
    $.ajax({
      url: baseUri + "locations/latest",
      context: this,
      success: function(data) {
        this.app.updateStatus("locations loaded");
        data.features.forEach(this.handleLocation.bind(this));
        this.connect.bind(this)();
        if (callback) callback();
      }
    });
  }

  loadMetadata(callback) {
    $.ajax({
      url: baseUri + "metadata/vessels",
      context: this,
      success: function(data) {
        this.app.updateStatus("vessels loaded");
        data.forEach(this.handleMetadata.bind(this));
        if (callback) callback();
      }
    });
  }

  init() {
    console.log('init', this.app.updateStatus);
    this.lastUpdate = Date.now();
    this.app.updateStatus("initializing");
    this.loadMetadata(() => { this.loadLocations.bind(this)( () => { this.connect.bind(this); } )});
  }

  updatePosition(feature) {
    var closestPierAndDistance = piers.reduce(function(closest, pier) {
      var dist = distance(pier.coords, feature.geometry.coordinates);
      return dist >= closest.dist? closest: {pier: pier, dist: dist};
    }, {pier: null, dist: 10000000 });
    
    var dist = Math.round(closestPierAndDistance.dist);
    var pier = closestPierAndDistance.pier;

    if (!this.latestPositions[feature.mmsi]) this.latestPositions[feature.mmsi] = {};
    var position = this.latestPositions[feature.mmsi];

    var positionStr;
    var status = position.status || STATUS.STOPPED;
    var range1 = pier.coords.length > 2? pier.coords[2]: 100;
    var range2 = pier.coords.length > 3? pier.coords[3]: range1*2.5;
    var age = Math.round((Date.now() - feature.properties.timestampExternal)/1000);

    if (feature.properties.sog >= 0.7) {
      status = STATUS.ONTHEMOVE;
      position.returned = false;
    } else if (feature.properties.sog <= 0.2) {
      if (status !== STATUS.STOPPED) {
        if (position.latestPierName === pier.name && dist < range1) {
          position.returned = true;
        }
      }
      status = STATUS.STOPPED;
    }

    if (status === STATUS.STOPPED) {
      if (dist < range1) {
        positionStr = (position.returned? "Returned to ": "Stopped at ") + pier.name;
        position.latestPierName = pier.name;
        position.latestPierTimestamp = feature.properties.timestampExternal;
      } else {
        positionStr = "Stopped " + Math.round(dist/1000) + " km from " + pier.name;
      }
    } else {
      if (dist < range2) {
        if (pier.name === position.latestPierName) {
          positionStr = "Departing " + pier.name;
        }  else {
          positionStr = "Approaching " + pier.name;
        }
      } else {
        positionStr = "On the move";
      }
    }
    if (position.latest !== positionStr) {
      position.status = status;
      position.latest = positionStr;
      var mmsi = feature.mmsi;
      var name = this.vessels[mmsi].name;
      var time = new Date(feature.properties.timestampExternal);
      if (positionStr === 'On the move' && position.latestPierName) positionStr += ". Left " + position.latestPierName + " at " + new Date(position.latestPierTimestamp).toLocaleTimeString("fi") + ".";
      positionStr += " " + feature.geometry.coordinates + " " + feature.properties.sog + " " + feature.properties.cog + " " + feature.properties.heading;
      this.app.addPositionLine(time, " (" + age + "): " + name + ": " + positionStr);
    }
  }

}

export default VesselStatus;
