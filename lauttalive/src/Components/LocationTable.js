import React, { Component } from 'react';
import LocationTableItem from './LocationTableItem';
import { connect } from 'react-redux';
import * as actions from '../actions/messageActions';

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

  handleClick(event) {
    this.props.dispatch(actions.setLocationFilter(event.target.checked));
  }

  render() {
    let i = 1;
    let items = Object.keys(this.props.locations).sort()
      .map(mmsi => {return this.props.locations[mmsi]; })
      .filter(l => {return !this.props.filterOn || isRecentLocation(l.location, this.state.now); })
      .sort((a,b) => {return a.vessel.name + a.vessel.mmsi > b.vessel.name + b.vessel.mmsi? 1: -1; })
      .map(l => {
        return (<LocationTableItem key={l.vessel.mmsi} index={i++} data={l} now={this.state.now}/>)
    });

    if (items.length > 0) {
      return (
        <div className="LocationTable">
          <label htmlFor="filterCheckbox">Show only recent locations</label>
          <input id="filterCheckbox" type="checkbox" onChange={this.handleClick.bind(this)} ref="filterCheckbox" defaultChecked={this.props.filterOn} />
          <table>
            <tbody>
              <tr><th>#</th><th>MMSI</th><th>vessel name</th><th>age</th><th>location</th><th>speed</th><th>course</th><th>heading</th><th>destination</th><th>position</th></tr>
              {items}
            </tbody>
          </table>
        </div>
      );
    } else {
      return (
        <strong>No locations received yet</strong>
      );
    } 
  }
}

const mapStateToProps = (state) => {
  return {
    locations: state.messages.locations,
    filterOn: state.messages.locationFilter,
    dispatch: state.dispatch
  };
};

export default connect(mapStateToProps)(LocationTable);
