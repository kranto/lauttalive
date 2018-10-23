import MQTT from 'paho-mqtt';
import axios from 'axios';
import * as actions from '../actions/messageActions';

// workaround: https://github.com/eclipse/paho.mqtt.javascript/issues/150
window.Paho = {MQTT};

let baseUri = "https://meri-aws-mqtt-test.digitraffic.fi/api/v1/";
let baseUriHost = "meri-aws-mqtt-test.digitraffic.fi";
let STATUS = { STOPPED: 0, ONTHEMOVE: 1 };

function distance(c1, c2) {
  return Math.max(Math.abs(c1[0]-c2[0])*55000, Math.abs(c1[1]-c2[1])*110000);
}

function isPassangerVessel(metadata) {
  return metadata && (metadata.shipType === 0 || metadata.shipType === 60);
}

function isInArea(feature) {
  var coords = feature.geometry.coordinates;
  return (coords[0] >= 19.8 && coords[0] <= 23 && coords[1] >= 59.7 && coords[1] <= 60.7);
}

// --

class VesselStatus {

  constructor(store) {
    this.connectOk = false;
    this.messageCount = 0;
    this.lastUpdate = 0;
    this.vessels = {};
    this.latestLocations = {};
    this.latestPositions = {};
    this.store = store;
  }

  connect() {
    this.store.dispatch(actions.statusUpdated("Connecting"));
    this.connectOk = false;
    this.messageCount = 0;

    // workaround: https://github.com/eclipse/paho.mqtt.javascript/issues/150
    this.client = new window.Paho.MQTT.Client(baseUriHost, 61619, 'testclient_' + Date.now());
    // this.client = new Paho.Client("", 61619, '');
    this.client.onConnectionLost = this.onConnectionLost.bind(this);
    this.client.onMessageArrived = this.onMessageArrived.bind(this);

    const connectionProperties = {
      onSuccess:this.onConnect.bind(this),
      mqttVersion:4,
      useSSL:true,
      userName:"digitraffic",
      password:"digitrafficPassword"
    };
    this.client.connect(connectionProperties);
  }

  onConnectionLost(response) {
    this.store.dispatch(actions.statusUpdated("Connection lost"));
  }
    
  onMessageArrived(message) {
    let content = message.payloadString;
    let data = JSON.parse(content);
    let time = Date.now();
    let origTime = data.timestamp? data.timestamp: data.properties.timestampExternal;
    let latency = Math.max(0, time - origTime);
    let msg = { time: time, latency: latency, topic: message.destinationName, data: data };

    this.store.dispatch(actions.newMessage(msg));
    if (this.messageCount++ === 0) {
      this.store.dispatch(actions.statusUpdated("First message arrived", "firstmessagearrived"));
    } else {
      this.store.dispatch(actions.statusUpdated("Messages arrived: " + this.messageCount, "messagearrived"));
    }
    this.handleMessage(data);
  }

  onConnect() {
    this.store.dispatch(actions.statusUpdated("Connected"));
    if (this.connectOk) return;
    this.connectOk = true;
    this.messageCount = 0;
    var client = this.client;
    Object.keys(this.latestLocations)
      .forEach(mmsi => { client.subscribe("vessels/" + mmsi + "/#"); });
    otherVessels
      .filter(mmsi => { return this.latestLocations[mmsi]; })
      .forEach(mmsi => { client.subscribe("vessels/" + mmsi + "/#"); });
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

  handleMessage(data) {
    if (data && data.shipType) { // is metadata
      this.handleMetadata(data);
    }

    if (data && data.geometry) { // is location geojson
      this.handleLocation(data);
    }
  }

  async loadLocations(callback) {
    await axios.get(baseUri + "locations/latest")
    .then(({data}) => {
      this.store.dispatch(actions.statusUpdated("Locations loaded"));
      data.features.forEach(l => this.handleLocation(l));
    });
  }

  async loadMetadata(callback) {
    await axios.get(baseUri + "metadata/vessels")
    .then(({data}) => {
      this.store.dispatch(actions.statusUpdated("Vessels' metadata loaded"));
      data.forEach(v => this.handleMetadata(v));
    });
  }

  async init() {
    await loadData();
    
    this.lastUpdate = Date.now();
    this.store.dispatch(actions.statusUpdated("Initializing"));

    await this.loadMetadata();
    await this.loadLocations();
    this.connect();

    this.interval = setInterval(function() {
      if (Date.now() - this.lastUpdate > 30000) this.init();
    }.bind(this), 16000);
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
    let changed = position.latest !== positionStr;

    position.status = status;
    position.latest = positionStr;
    var mmsi = feature.mmsi;
    var time = feature.properties.timestampExternal;
    if (positionStr === 'On the move' && position.latestPierName) positionStr += ". Left " + position.latestPierName + " at " + new Date(position.latestPierTimestamp).toLocaleTimeString("fi") + ".";
    const entry = {time: time, latency: age, vessel: this.vessels[mmsi], location: feature, message: positionStr, isStopped: (status === STATUS.STOPPED), isReturned: position.returned, position: position};
    this.store.dispatch(actions.positionUpdated(entry, changed));
  }
}

export default VesselStatus;

// ---------

var piers = [];
var otherVessels = [];

async function loadData() {
  const pierPromise = axios.get("./data/piers.json");
  const vesselPromise = axios.get("./data/vessels.json");
  const [p, v] = await Promise.all([pierPromise, vesselPromise]);
  piers = p.data;
  otherVessels = v.data.map(vessel => vessel.mmsi);
}

