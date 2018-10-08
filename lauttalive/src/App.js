import React, { Component } from 'react';
import './App.css';
import Messages from './Components/Messages'
import Log from './Components/Log'
import PositionLog from './Components/PositionLog'
import LocationTable from './Components/LocationTable'
import VesselStatus from './lib/VesselStatus'
import { Provider } from "react-redux";
import store from "./store";

class App extends Component {
  constructor() {
    super();
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
          <Messages />
          <h2>Log</h2>
          <Log />
          <h2>Position updates</h2>
          <PositionLog />
          <h2>Locations</h2>
          <LocationTable />
        </div>
      </Provider>
    );
  }
}

export default App;
