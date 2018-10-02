import React, { Component } from 'react';

class MessageItem extends Component {

  constructor() {
    super();
  }

  render() {
    return (
      <div className="MessageItem">
        {this.props.text}
      </div>
    );
  }
}

export default MessageItem;
