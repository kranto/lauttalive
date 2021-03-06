import React, { Component } from 'react';

class MessageItem extends Component {

  shouldComponentUpdate() {
    return false;    
  }

  render() {
    let m = this.props.message;
    return (
      <div className="MessageItem">
        {m.time}({m.latency}): {m.topic}: {JSON.stringify(m.data)}
      </div>
    );
  }
}

export default MessageItem;
