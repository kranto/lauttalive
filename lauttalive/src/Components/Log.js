import React, { Component } from 'react';
import LogItem from './LogItem';

class Log extends Component {

  render() {
    let logItems = this.props.log.map(l => {
      return (<LogItem key={l.time} time={l.time} message={l.message}/>)
    });

    return (
      <div className="Log">
        {logItems}
      </div>
    );
  }
}

export default Log;
