import React from 'react';
import AutoScrollList from './AutoScrollList';
import LogItem from './LogItem';

class Log extends AutoScrollList {

  render() {
    let logItems = this.props.log.map(l => {
      return (<LogItem key={l.time} time={l.time} message={l.message}/>)
    });

    return (
      <div className="Log" ref={(div) => {this.autoScrollList = div;}}>
        {logItems}
      </div>
    );
  }
}

export default Log;
