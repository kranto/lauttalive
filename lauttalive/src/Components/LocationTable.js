import React, { Component } from 'react';
import LocationTableItem from './LocationTableItem';
import { connect } from 'react-redux';

function isRecentLocation(location, now) {
  return now*1000 - location.properties.timestampExternal < 600000;
}

class LocationTable extends Component {

  constructor() {
    super();
    this.state = { now: Math.round(Date.now()/1000) };
  }

  componentDidMount() {
    this.interval = setInterval(() => { this.setState({now: Math.round(Date.now()/1000)}); }, 1000);
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  render() {
    let i = 1;
    let items = Object.keys(this.props.locations).sort()
      .map(mmsi => {return this.props.locations[mmsi]; })
      .filter(l => {return isRecentLocation(l.location, this.state.now); })
      .sort((a,b) => {return a.vessel.name + a.vessel.mmsi > b.vessel.name + b.vessel.mmsi? 1: -1; })
      .map(l => {
        return (<LocationTableItem key={l.vessel.mmsi} index={i++} data={l} now={this.state.now}/>)
    });

    return (
      <table className="LocationTable">
        <tbody>
          <tr><th>#</th><th>MMSI</th><th>vessel name</th><th>age</th><th>location</th><th>speed</th><th>course</th><th>heading</th><th>destination</th><th>position</th></tr>
          {items}
        </tbody>
      </table>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    locations: state.messages.locations
  };
};

export default connect(mapStateToProps)(LocationTable);
