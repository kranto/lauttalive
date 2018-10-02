import React, { Component } from 'react';
import MessageItem from './MessageItem';
import uuid from 'uuid';

class Messages extends Component {

  constructor() {
    super();
    this.state = {
      isSuspended: false,
    }
  }

  resumeUpdate() {
    this.setState({isSuspended: false});
  }

  suspendUpdate() {
    this.setState({isSuspended: true});
  }

  shouldComponentUpdate() {
    return !this.state.isSuspended;
  }

  classes() {
    return "Messages " + (this.state.isSuspended? "suspended": "");
  }

  render() {
    let messageItems = this.props.messages.map(m => {
      return (<MessageItem key={m} text={m}/>)
    });

    return (
      <div className={this.classes()} onMouseEnter={this.suspendUpdate.bind(this)} onMouseLeave={this.resumeUpdate.bind(this)}>
        {messageItems}
      </div>
    );
  }
}

export default Messages;
