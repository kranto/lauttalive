import React from 'react';
import AutoScrollList from './AutoScrollList';
import MessageItem from './MessageItem';
import { connect } from 'react-redux';

class Messages extends AutoScrollList {

  constructor() {
    super();
    this.state = {
      isSuspended: false,
    }
  }

  resumeUpdate() {
    this.setState({isSuspended: false});
    this.forceUpdate();
  }

  suspendUpdate() {
    this.setState({isSuspended: true});
    this.forceUpdate();
  }

  shouldComponentUpdate() {
    return !this.state.isSuspended;
  }

  classes() {
    return "Messages " + (this.state.isSuspended? "suspended": "");
  }

  render() {
    let messageItems = this.props.messages.map(m => {
      return (<MessageItem key={m.id} message={m}/>)
    });

    return (
      <div className={this.classes()} onMouseEnter={this.suspendUpdate.bind(this)} onMouseLeave={this.resumeUpdate.bind(this)} ref={(div) => {this.autoScrollList = div;}}>
        {messageItems}
      </div>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    messages: state.messages.messages
  };
};

export default connect(mapStateToProps)(Messages);

