import paho.mqtt.client as mqtt
import json
import yaml
import requests
import io
from time import time,sleep
import urllib2

rest_base_uri = 'http://meri-aws-test.digitraffic.fi/api/v1'
mqtt_uri = 'meri-aws-mqtt-test.digitraffic.fi'
mqtt_port = 9001

vessels = {}
locations = {}

subscribed = False

def connect():
	client.connect(mqtt_uri, mqtt_port, 60)
	client.loop_start()

def on_connect(client, userdata, flags, rc):
    print "on_connect"
    if not subscribed:
	    client.subscribe("vessels/#")
	    subscribed = True

def on_message(client, userdata, msg):
    #print(msg.topic+" "+str(msg.payload))
    handle_message(msg.payload)

def is_passanger_vessel(metadata):
	return metadata["shipType"] == 0 or metadata["shipType"] == 60

def is_in_area(feature):
	coords = feature["geometry"]["coordinates"]
	return 18 <= coords[0] <= 23 and 59 <= coords[1] <= 61

def store_metadata(metadata):
	#print "meta", json.dumps(metadata)
	vessels[metadata["mmsi"]] = metadata

def handle_metadata(metadata):
	if is_passanger_vessel(metadata):
		store_metadata(metadata)

def store_location(feature):
	feature["properties"]["mmsi"] = feature["mmsi"]
	feature["properties"]["vessel"] = vessels[feature["mmsi"]]
	locations[feature["mmsi"]] = feature

def handle_location(feature):
	locations.pop(feature["mmsi"], None)
	if is_in_area(feature) and feature["mmsi"] in vessels:
		print (time() - feature["properties"]["timestampExternal"]/1000), vessels[feature["mmsi"]]["name"]
		store_location(feature)

def handle_message(msg):
	data = yaml.safe_load(msg)
	if "shipType" in data:
		handle_metadata(data)
	elif "geometry" in data:
		handle_location(data)

def initial_load():
	metadata_json = urllib2.urlopen(rest_base_uri + "/metadata/vessels").read()
	for metadata in yaml.safe_load(metadata_json): 
		handle_metadata(metadata)
	location_json = urllib2.urlopen(rest_base_uri + "/locations/latest").read()
	feature_collection = yaml.safe_load(location_json)
	for feature in feature_collection["features"]: 
		handle_location(feature)

def initial_load2():
	r = requests.get(rest_base_uri + '/metadata/vessels')
	for metadata in yaml.safe_load(r.text): 
		handle_metadata(metadata)
	r = requests.get(rest_base_uri + '/locations/latest')
	feature_collection = yaml.safe_load(r.text)
	for feature in feature_collection["features"]: 
		handle_location(feature)

def output_locations():
	now = int(time()*1000)
	features = [f for f in locations.values() if (now - f["properties"]["timestampExternal"])/1000 <= 600]
	feature_collection = {"features": features}
	with io.open('livedata.json1', 'w') as f:
  		f.write(unicode(json.dumps(feature_collection).encode('UTF-8')))

def output_locations_forever():
	while True:
		output_locations()
		sleep(10)

# --

client = mqtt.Client(transport="websockets")
client.on_connect = on_connect
client.on_message = on_message

initial_load()
connect()
output_locations_forever()
