import React, { Component } from 'react';

class MessageItem extends Component {

  constructor() {
    super();
  }

  shouldComponentUpdate() {
    return false;    
  }

  render() {
    let m = this.props.message;
    return (
      <div className="MessageItem">
        {m.time}({m.latency}): {m.topic}: {JSON.stringify(this.props.message.data)}
      </div>
    );
  }
}

export default MessageItem;
