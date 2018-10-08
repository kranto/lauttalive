import React, { Component } from 'react';

class LogItem extends Component {

  constructor() {
  	super();
  	this.prevTime = 0;
  }

  shouldComponentUpdate(nextProps) {
    return this.prevTime !== nextProps.time;
  }

  render() {
  	this.prevTime = this.props.time;
    return (
      <div className="LogItem">
        {new Date(this.props.time).toLocaleTimeString("fi")} {this.props.message}
      </div>
    );
  }
}

export default LogItem;
