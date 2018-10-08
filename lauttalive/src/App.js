import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import Messages from './Components/Messages'
import Log from './Components/Log'
import LogItem from './Components/LogItem'
import PositionLog from './Components/PositionLog'
import LocationTable from './Components/LocationTable'
import VesselStatus from './lib/VesselStatus'
import { Provider } from "react-redux";
import store from "./store";

class App extends Component {
  constructor() {
    super();
    this.state = {
      messages: [],
      log: [],
      positionLog: [],
      locations: {}
    }
    this.vesselStatus = new VesselStatus(this, store);
  }

  componentWillMount() {
    this.vesselStatus.init();
  }

  render() {
    return (
      <Provider store={store}>
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
      </Provider>
    );
  }
}

export default App;
