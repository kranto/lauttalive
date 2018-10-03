import React from 'react';
import AutoScrollList from './AutoScrollList';
import PositionLogItem from './PositionLogItem';

class PositionLog extends AutoScrollList {

  render() {
    let logItems = this.props.log.map(l => {
      return (<PositionLogItem key={l.id} line={l}/>)
    });

    return (
      <div className="PositionLog" ref={(div) => {this.autoScrollList = div;}}>
        {logItems}
      </div>
    );
  }
}

export default PositionLog;
