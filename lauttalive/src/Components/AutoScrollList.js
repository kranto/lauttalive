import { Component } from 'react';

class AutoScrollList extends Component {

  componentDidUpdate() {
    this.scrollToBottom();
  }

  scrollToBottom() {
    const scrollHeight = this.autoScrollList.scrollHeight;
    const height = this.autoScrollList.clientHeight;
    const maxScrollTop = scrollHeight - height;
    this.autoScrollList.scrollTop = maxScrollTop > 0 ? maxScrollTop : 0;
  }

}

export default AutoScrollList;
