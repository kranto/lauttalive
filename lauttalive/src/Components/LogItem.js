import React, { Component } from 'react';

class LogItem extends Component {

  render() {
    return (
      <div className="LogItem">
        {new Date(this.props.time).toLocaleTimeString("fi")} {this.props.message}
      </div>
    );
  }
}

export default LogItem;
