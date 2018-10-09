import React, { Component } from 'react';

class LocationTableItem extends Component {

  classes() {
    return "LocationTableItem " + (this.props.data.isReturned? "returned": this.props.data.isStopped? "halted": "onmove");
  }

  shouldComponentUpdate(nextProps) {
    return nextProps.now !== this.prevNow || nextProps.index !== this.prevIndex;
  }

  render() {
    this.prevNow = this.props.now;
    this.prevIndex = this.props.index;
    let d = this.props.data;
    let v = d.vessel;
    let l = d.location;
    let g = l.geometry;
    let p = l.properties;
    let leftSecondsAgo = d.position.latestPierTimestamp? this.props.now - d.position.latestPierTimestamp/1000: 0;
    let leftMessage = d.position.latest === "On the move" && d.position.latestPierTimestamp?
     ". Left " + d.position.latestPierName + " " + Math.round(leftSecondsAgo/60) + " minutes ago": "";
    return (
      <tr className={this.classes()}>
        <td align="right">{this.props.index}</td>
        <td>{v.mmsi}</td>
        <td>{v.name}</td>
        <td align="right">{this.props.now - Math.round(d.time/1000)}</td>
        <td>{"" + g.coordinates}</td>
        <td align="right">{p.sog}</td>
        <td align="right">{p.cog}</td>
        <td align="right">{p.heading}</td>
        <td>{v.destination}</td>
        <td>{d.position.latest + leftMessage}</td>
      </tr>
    );
  }
}

export default LocationTableItem;
