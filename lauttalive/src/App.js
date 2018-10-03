import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import Messages from './Components/Messages'
import Log from './Components/Log'
import LogItem from './Components/LogItem'
import PositionLog from './Components/PositionLog'
import LocationTable from './Components/LocationTable'
import VesselStatus from './lib/VesselStatus'
import uuid from 'uuid';

class App extends Component {
  constructor() {
    super();
    this.state = {
      messages: [],
      log: [],
      positionLog: [],
      locations: {}
    }
    this.vesselStatus = new VesselStatus(this);
  }

  componentWillMount() {
    this.vesselStatus.init();
  }

  updateStatus(msg, msgId) {
    let time = Date.now();
    msgId = msgId? msgId: null;
    let log = this.state.log;
    if (log.length > 0 && log[log.length-1].msgId !== null && log[log.length-1].msgId === msgId) {
      log.pop();
    }
    log.push({time: time, message: msg, msgId: msgId});
    if (log.length > 1000) log.shift();
    this.setState({log: log});
  }

  addRawMessage(msg) {
    msg.id = uuid.v4();
    let messages = this.state.messages;
    messages.push(msg);
    if (messages.length > 100) messages.shift();
    this.setState({messages: messages});
  }

  positionUpdate(entry, changed) {
    this.setState((state) => {
      let newState = {};
      if (changed) {
        entry.id = uuid.v4();
        let positionLog = state.positionLog;
        positionLog.push(entry);
        positionLog.sort((a,b) => { return a.time - b.time; });
        if (positionLog.length > 150) positionLog.shift();
        newState.positionLog = positionLog;
      }
      newState.locations = state.locations;
      newState.locations[entry.vessel.mmsi] = entry;
      return newState;
    });
  }

  render() {
    return (
      <div className="App">
        <h2>Raw Messages</h2>
        <Messages messages={this.state.messages}/>
        <h2>Log</h2>
        <Log log={this.state.log} />
        <h2>Position updates</h2>
        <PositionLog log={this.state.positionLog} />
        <h2>Locations</h2>
        <LocationTable locations={this.state.locations} />
      </div>
    );
  }
}

export default App;
