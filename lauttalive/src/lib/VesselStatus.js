import MQTT from 'paho-mqtt';
import $ from 'jquery';

// workaround: https://github.com/eclipse/paho.mqtt.javascript/issues/150
window.Paho = {MQTT};

let baseUri = "https://meri-aws-test.digitraffic.fi/api/v1/";
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

  constructor(app) {
    this.app = app;
    this.connectOk = false;
    this.messageCount = 0;
    this.lastUpdate = 0;
    this.vessels = {};
    this.latestLocations = {};
    this.latestPositions = {};
  }

  connect() {
    console.log('trying to connect...');
    this.app.updateStatus("connecting");
    this.connectOk = false;
    this.messageCount = 0;

    // workaround: https://github.com/eclipse/paho.mqtt.javascript/issues/150
    this.client = new window.Paho.MQTT.Client("", 61619, '');
    // this.client = new Paho.Client("", 61619, '');
    this.client.onConnectionLost = this.onConnectionLost.bind(this);
    this.client.onMessageArrived = this.onMessageArrived.bind(this);

    this.client.connect({
      hosts:["b-afca9ce3-f38d-459d-b495-43d879decdaa-1.mq.eu-west-1.amazonaws.com","b-afca9ce3-f38d-459d-b495-43d879decdaa-2.mq.eu-west-1.amazonaws.com"],
      ports:[61619,61619],
      onSuccess:this.onConnect.bind(this),
      mqttVersion:4,
      useSSL:true,
      userName:"marine", password:"digitraffic_marine"});
  }

  onConnectionLost(response) {
    console.info('Connection lost:' + response.errorMessage);
    this.app.updateStatus("connection lost");
  }
    
  onMessageArrived(message) {
    let content = message.payloadString;
    let data = JSON.parse(content);
    let time = Date.now();
    let origTime = data.timestamp? data.timestamp: data.properties.timestampExternal;
    let latency = Math.max(0, time - origTime);
    let msg = { time: time, latency: latency, topic: message.destinationName, data: data };
    this.app.addRawMessage(msg);
    if (this.messageCount++ === 0) {
      this.app.updateStatus("First message arrived", "firstmessagearrived");
    } else {
      this.app.updateStatus("Messages arrived: " + this.messageCount, "messagearrived");                    
    }
    this.handleMessage(data);
  }

  onConnect() {
    console.info('Connection open');
    this.app.updateStatus("connected");
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
    let changed = position.latest !== positionStr;

    position.status = status;
    position.latest = positionStr;
    var mmsi = feature.mmsi;
    var time = feature.properties.timestampExternal;
    if (positionStr === 'On the move' && position.latestPierName) positionStr += ". Left " + position.latestPierName + " at " + new Date(position.latestPierTimestamp).toLocaleTimeString("fi") + ".";
    this.app.positionUpdate({time: time, latency: age, vessel: this.vessels[mmsi], location: feature, message: positionStr, isStopped: (status === STATUS.STOPPED), isReturned: position.returned, position: position}, changed);
  }

}

export default VesselStatus;

// ---------

        var piers = [

{name: "Krok", coords: [21.735581,60.127427]},
{name: "Innamo", coords: [21.751985,60.24948]},
{name: "Aspholm", coords: [22.175431,60.165596]},
{name: "Stenholm", coords: [22.164897,60.170458]},
{name: "Åva", coords: [21.058141,60.503277]},
{name: "Svinö", coords: [20.267629,60.066551]},
{name: "Vänoxa släten", coords: [22.608219,59.964509]},
{name: "Degerby", coords: [20.385861,60.031854]},
{name: "Grötö", coords: [22.015421,60.079999]},
{name: "Ängesö", coords: [22.506408,59.949735]},
{name: "Seglinge", coords: [20.710151,60.215518]},
{name: "Finholma", coords: [20.526409,60.074604]},
{name: "Jyddö", coords: [20.527128,60.076483]},
{name: "Norrboda", coords: [20.289602,60.153104]},
{name: "Ängö", coords: [20.294537,60.154129]},
{name: "Prästö", coords: [20.2722,60.207997]},
{name: "Töftö", coords: [20.277661,60.20571]},
{name: "Sandö", coords: [20.372257,60.322485]},
{name: "Simskäla", coords: [20.365369,60.331536]},
{name: "Lappo L", coords: [20.952172,60.311419]},
{name: "Björkö K", coords: [20.941593,60.311052]},
{name: "Björkö H", coords: [21.405916,60.265682]},
{name: "Mossala E", coords: [21.406002,60.268705]},
{name: "Kivimo", coords: [21.335631,60.235044]},
{name: "Näsby I", coords: [21.39553,60.217457]},
{name: "Saverkeit", coords: [21.403148,60.216807]},
{name: "PalvaI", coords: [21.67566,60.46787]},
{name: "PalvaL", coords: [21.648259,60.461174]},
{name: "Velkuanmaa", coords: [21.6365,60.455059]},
{name: "Högsåra", coords: [22.369194,59.954602]},
{name: "Våno", coords: [22.303866,60.216839]},
{name: "Mielisholm", coords: [22.306484,60.215294]},
{name: "Ängholm", coords: [21.880308,60.167007]},
{name: "Grännäs", coords: [21.878919,60.169672]},
{name: "Sorpo", coords: [22.281830,60.150910]},
{name: "Jermo", coords: [22.285522,60.150366]},
{name: "Angelniemi", coords: [22.943916,60.312752]},
{name: "Kokkila", coords: [22.943401,60.318236]},
{name: "Ulkoluoto", coords: [22.915098,60.041173]},
{name: "Pettu", coords: [22.92293,60.038488]},
{name: "Berghamn", coords: [21.801638,60.054398]},
{name: "Kälö", coords: [21.354325,60.076682]},
{name: "Biskopsö", coords: [22.558762,59.970835]},
{name: "Södö", coords: [21.197489,60.32606]},
{name: "Botesö", coords: [22.609967,59.944891]},
{name: "Talosmeri", coords: [21.681705,60.457027]},
{name: "PensarI", coords: [22.136839,60.147967]},
{name: "Teersalo", coords: [21.693964,60.467404]},
{name: "Pähkinäinen", coords: [21.69538,60.33036]},
{name: "Galtby", coords: [21.585538,60.185467]},
{name: "PensarL", coords: [22.109835,60.151166]},
{name: "Österskär", coords: [21.291621,59.978844]},
{name: "Bockholm", coords: [21.190895,60.314577]},
{name: "Nåtö", coords: [21.157187,60.341261]},
{name: "Utö", coords: [21.368236,59.786521]},
{name: "Perkala Norr", coords: [21.475604,60.379092]},
{name: "Lempmo", coords: [21.270456,60.319503]},
{name: "Mattnäs", coords: [21.811165,60.137722]},
{name: "Härklot", coords: [21.178764,60.355844]},
{name: "Nagu", coords: [21.911652,60.194044]},
{name: "Keso", coords: [21.941702,60.192928]},
{name: "Salmis", coords: [21.286463,60.320995]},
{name: "Åselholm", coords: [21.220324,60.415507]},
{name: "Pakinainen", coords: [21.687852,60.355222]},
{name: "Vänö", coords: [22.196503,59.868326]},
{name: "Hummelvik", coords: [20.413541,60.224395]},
{name: "Munninmaa", coords: [21.68096,60.420391]},
{name: "Snäckö", coords: [20.726287,60.219434]},
{name: "Snäckö", coords: [21.393624,60.420752]},
{name: "Heponiemi", coords: [21.434991,60.485211]},
{name: "Heponiemi", coords: [21.708514,60.431601]},
{name: "Åvensor", coords: [21.578199,60.298307]},
{name: "Ruotsalainen", coords: [21.764635,60.367983]},
{name: "Aurajoki", coords: [22.2509248,60.443111]},
{name: "Aurajoki2", coords: [22.25374,60.44432]},
{name: "Aurajoki3", coords: [22.24073,60.43719,100]},
{name: "Naantali Vanhakaupunki", coords: [22.014539,60.469716]},
{name: "Merimasku", coords: [21.852873,60.489515]},
{name: "Parattula", coords: [21.434322,60.496449]},
{name: "Kivimaa 2", coords: [21.337153,60.541838]},
{name: "Berghamn (Eckerö)", coords: [19.535583,60.225623,400]},
{name: "Rauhala", coords: [21.697809,60.448909]},
{name: "Liettinen", coords: [21.754717,60.424009]},
{name: "Själö", coords: [21.17333,60.375063]},
{name: "Byskär", coords: [21.969866,60.084173]},
{name: "Maisaari", coords: [21.893925,60.332172]},
{name: "Helsingholm", coords: [22.283115,60.031447]},
{name: "Perkala", coords: [21.474173,60.367269]},
{name: "Ängsö", coords: [21.723747,60.104317]},
{name: "Aspö", coords: [21.614291,59.951518]},
{name: "Haapala", coords: [21.809438,60.394565]},
{name: "Berghamn (Houtskari)", coords: [21.303469,60.148768]},
{name: "Torsholma I", coords: [21.070929,60.363764]},
{name: "Trunsö", coords: [21.77237,59.882509]},
{name: "Gloskär", coords: [21.775197,59.880943]},
{name: "Ytterstö", coords: [21.264332,60.316069]},
{name: "Ramsholm", coords: [22.1841,60.169994]},
{name: "Tammisluoto", coords: [21.737652,60.411011]},
{name: "Rockelholm", coords: [21.888574,60.099841]},
{name: "Hanka", coords: [21.968836,60.28578]},
{name: "Holma", coords: [22.366826,59.908183]},
{name: "Näsby", coords: [21.368018,60.224502]},
{name: "Hakkenpää", coords: [21.613411,60.499257]},
{name: "Äpplö", coords: [21.219441,60.310094]},
{name: "Roslax", coords: [21.335171,60.233416]},
{name: "Lempnäs", coords: [21.295199,60.302546]},
{name: "Kökar", coords: [20.892342,59.945804]},
{name: "Björkholm", coords: [22.23607,60.185211]},
{name: "Knivskär", coords: [21.975488,60.011622]},
{name: "Lavarn", coords: [21.59882,60.256954]},
{name: "Granvik", coords: [22.261401,60.196518]},
{name: "Granholmen", coords: [22.249604,60.190669]},
{name: "Kasnäs", coords: [22.412002,59.921237]},
{name: "Torsholma", coords: [21.038045,60.356698]},
{name: "Brännskär", coords: [21.975939,60.086345]},
{name: "Bolax", coords: [22.710532,59.945743]},
{name: "Hanko itäsatama", coords: [22.9637498,59.8192902]},
{name: "Hanko länsisatama", coords: [22.94867,59.82167]},
{name: "Rosala", coords: [22.415102,59.854007]},
{name: "Bengtskär", coords: [22.500117,59.723477]},
{name: "Örö", coords: [22.337143,59.811043]},
{name: "Korpoström", coords: [21.600531,60.111081]},
{name: "Borstö", coords: [21.969351,59.8621]},
{name: "Kvarnholm", coords: [21.197915,60.392141]},
{name: "Maskinnamo", coords: [21.637165,60.283344]},
{name: "Asterholma", coords: [21.03399,60.304093]},
{name: "Samsaari", coords: [21.827492,60.319026]},
{name: "Sottunga", coords: [20.682224,60.109975]},
{name: "Lånholm", coords: [21.741514,60.121329]},
{name: "Sördö", coords: [21.291789,60.283513]},
{name: "Storpensor", coords: [21.508388,60.232623]},
{name: "Dalsbruk", coords: [22.50627,60.01904]},
{name: "Turku", coords: [22.217016,60.43461,400,500]},
{name: "Jurmo", coords: [21.584765,59.827089]},
{name: "Jurmo (Brändö)", coords: [21.074051,60.515948]},
{name: "Enklinge", coords: [20.751087,60.318366]},
{name: "Luk", coords: [21.32105,60.151441]},
{name: "Östra Tallholm", coords: [22.16423,60.160215, 30]},
{name: "Kettumaa", coords: [21.690759,60.403492]},
{name: "Korvenmaa", coords: [21.68068,60.36563]},
{name: "Norrby", coords: [21.389945,60.397095]},
{name: "Lammholm", coords: [21.313279,60.338702]},
{name: "Fagerholm", coords: [21.698287,60.112033]},
{name: "Killingholm", coords: [21.678341,60.111031]},
{name: "Kivimaa", coords: [21.336221,60.542614]},
{name: "Lillmälö", coords: [22.112581,60.235417]},
{name: "Prostvik", coords: [22.097969,60.222557]},
{name: "Prostvik2", coords: [22.09522,60.2186,50]},
{name: "Svartnäs", coords: [22.3952,59.9491]},
{name: "Retais", coords: [21.69141,60.165927]},
{name: "Skagen", coords: [21.368536,60.406191]},
{name: "Jumo", coords: [21.369953,60.411532]},
{name: "Aasla", coords: [21.961557,60.313804]},
{name: "Airismaa", coords: [21.963268,60.316201]},
{name: "Sandholm", coords: [21.808966,59.903751]},
{name: "Lappo", coords: [20.995838,60.317449]},
{name: "Lökholm", coords: [21.882362,59.91246]},
{name: "Långnäs", coords: [20.299751,60.117047,400]},
{name: "Kuggö", coords: [22.161226,60.147871]},
{name: "Överö", coords: [20.510879,60.111381]},
{name: "Keistiö", coords: [21.34945,60.372322]},
{name: "LångnäsH", coords: [22.448759,59.872651]},
{name: "Kumlinge", coords: [20.789458,60.290497]},
{name: "Heisala", coords: [22.258966,60.177134]},
{name: "Gullkrona", coords: [22.083056,60.088282]},
{name: "Ytterstholm", coords: [21.9265,60.119447]},
{name: "Hällö", coords: [19.768695,60.366164]},
{name: "Kopparholm", coords: [21.899807,59.967932]},
{name: "Naantali", coords: [22.040076,60.458064,400]},
{name: "Brunskär", coords: [21.501213,60.04182]},
{name: "Tveskiftsholm", coords: [21.749861,60.105702]},
{name: "Nötö", coords: [21.75574,59.95385]},
{name: "Kolko", coords: [21.410176,60.418686]},
{name: "Kittuis", coords: [21.438145,60.186939]},
{name: "Elvsö", coords: [21.480661,60.138585]},
{name: "Havträsk", coords: [21.563861,60.235324]},
{name: "Träskholm", coords: [21.742222,59.913374]},
{name: "Bodö", coords: [21.750245,59.908368]},
{name: "Lailuoto", coords: [21.666731,60.454877]},
{name: "Verkan", coords: [21.556699,60.17469]},
{name: "Hummelholm", coords: [21.796746,60.100788]},
{name: "Skarpnåtö", coords: [19.761014,60.326841]},
{name: "Olofsnäs", coords: [21.558736,60.216566]},
{name: "Mariehamn", coords: [19.927654,60.092027,500]},
{name: "Mariehamn Svibyviken", coords: [19.92316,60.10084,100]},
{name: "Mariehamn Svibyviken2", coords: [19.921723,60.110567,500]},
{name: "Mariehamn Korrvik", coords: [19.93427,60.08026,100]},
{name: "Grisslehamn", coords: [18.815460,60.098146,400]},
{name: "Kapellskär", coords: [19.066601,59.722831,400]},
{name: "Tallinn", coords: [24.770607,59.443868]},
{name: "Paldiski", coords: [24.049,59.34883]},
{name: "Stockholm Stadsgården", coords: [18.096542,59.317076,400]},
{name: "Stockholm Värtan", coords: [18.108902,59.350346,400]},
{name: "Tunnhamn", coords: [22.183598,59.928128]},
{name: "Vuosnainen", coords: [21.247129,60.507276]},
{name: "Stenskär", coords: [22.048895,60.071307]},
{name: "Lillpensor", coords: [21.551424,60.246772]},
{name: "Seili", coords: [21.955146,60.236381]},
{name: "Bergö", coords: [20.392845,60.162687]},
{name: "Husö", coords: [20.80729,60.064637]},
{name: "Kyrkogårdsö", coords: [20.825057,60.031007]},
{name: "Dalen", coords: [21.371358,60.381576]},
{name: "Mossala", coords: [21.439133,60.289046]},
{name: "Djupö", coords: [22.560336,59.956664]},
{name: "Pärnäs", coords: [21.70495,60.16376]},
{name: "Vartsala", coords: [21.319699,60.54101]},
{name: "Peno", coords: [22.100801,60.144154]},
{name: "Björkö", coords: [21.691818,59.914106]},
{name: "Vänoxaby", coords: [22.610178,59.970745]},
{name: "Grönvik", coords: [22.591623,59.957799]},
{name: "Järvsor", coords: [21.695766,60.261191]},
{name: "Käldersö", coords: [21.496395,60.165352]},
{name: "Kannvik", coords: [21.396303,60.439205]},
{name: "Finnö", coords: [21.508906,60.180825]},
{name: "Kirjais", coords: [22.018189,60.121275]},
{name: "Helsinki Katajanokka", coords: [24.9638,60.16471,200]},
{name: "Helsinki Olympiaterminaali", coords: [24.95983,60.16134,200]},
{name: "Meyer Turku", coords: [22.11917,60.45428,200]},
{name: "Turku Pansio", coords: [22.157,60.44354,200]},
{name: "Turku Repair Yard", coords: [22.03059,60.45167,200]},
{name: "Teijon telakka", coords: [22.94611,60.25321,200]},

{name: "Kotka", coords: [26.96381,60.46029]},
{name: "Haapasaari", coords: [27.18597,60.28592]},
{name: "Kirkonmaa", coords: [27.013901,60.404639]},
{name: "Kuutsalo", coords: [27.008828,60.440956]},
{name: "Kaunissaari", coords: [26.775850,60.344613]},

        ];

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

