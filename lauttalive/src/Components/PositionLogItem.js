import React, { Component } from 'react';

class PositionLogItem extends Component {

  shouldComponentUpdate() {
    return false;    
  }

  render() {
    let l = this.props.line;
    let g = l.location.geometry;
    let p = l.location.properties;
    return (
      <div className="PositionLogItem">
         {new Date(l.time).toLocaleTimeString("fi")} ({l.latency}): {l.vessel.name}: {l.message} 
         <span className="smaller"> {g.coordinates[0]},{g.coordinates[1]} {p.sog} {p.cog} {p.heading}</span> 
      </div>
    );
  }
}

export default PositionLogItem;
