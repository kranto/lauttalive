import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import Messages from './Components/Messages'
import Log from './Components/Log'
import LogItem from './Components/LogItem'
import VesselStatus from './lib/VesselStatus'

class App extends Component {
  constructor() {
    super();
    this.state = {
      messages: [],
      log: [],
    }

    let v = new VesselStatus(this);
  }

  updateStatus(msg, msgId) {
    let time = Date.now();
    this.addLogMessage(time, msg, msgId);
  }

  addLogMessage(time, message, msgId) {
    msgId = msgId? msgId: null;
    let log = this.state.log;
    if (log.length > 0 && log[log.length-1].msgId !== null && log[log.length-1].msgId === msgId) {
      log.pop();
    }
    log.push({time: time, message: message, msgId: msgId});
    if (log.length > 1000) log.shift();
    this.setState({log: log});
    console.log(message, log.length);
  }

  addRawMessage(msg) {
    let messages = this.state.messages;
    messages.push(msg);
    if (messages.length > 100) messages.shift();
    this.setState({messages: messages});
  }

  addPositionLine(time, text) {
    console.log('addPositionLine', time, text);
  }

  render() {
    let status = this.state.log.length == 0? null: this.state.log[this.state.log.length - 1];
    let statusLine = status? (<LogItem time={status.time} message={status.message}/>): "";
    return (
      <div className="App">
        <h2>Raw Messages</h2>
        <Messages messages={this.state.messages}/>
        <h2>Status</h2>
        {statusLine}
        <h2>Log</h2>
        <Log log={this.state.log} />
        <h2>Position updates</h2>
        <h2>Locations</h2>
      </div>
    );
  }
}

export default App;

    // <h2>Raw Messages</h2>
    // <div class="messages" onmouseenter="suspendUpdate()" onmouseleave="resumeUpdate()" style="border: 1px solid; max-height: 300px; overflow-y: scroll; font-size: 0.7rem; "></div>
    // <h2>Status</h2>
    // <div class="status"></div>
    // <h2>Log</h2>
    // <div class="log" style="border: 1px solid; max-height: 300px; overflow-y: scroll;"></div>
    // <h2>Position updates</h2>
    // <div class="positions" style="border: 1px solid; max-height: 300px; overflow-y: scroll; "></div>
    // <h2>Locations</h2>
    // <div class="locations"><table class="locationstable"></table></div>
