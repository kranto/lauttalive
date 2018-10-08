import React from 'react';
import AutoScrollList from './AutoScrollList';
import PositionLogItem from './PositionLogItem';
import { connect } from 'react-redux';

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

const mapStateToProps = (state) => {
  return {
    log: state.messages.positionLog
  };
};

export default connect(mapStateToProps)(PositionLog);
